const playerConfig = window.SQUASHIQ_SUPABASE_CONFIG || {};
const playerSupabase = window.supabase && playerConfig.url && playerConfig.anonKey
  ? window.supabase.createClient(playerConfig.url, playerConfig.anonKey)
  : null;
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const intakeArea = document.querySelector('#intake-area');
const intakeForm = document.querySelector('#intake-form');
const intakeMessage = document.querySelector('#intake-message');
const videoInput = intakeForm.elements.video;
let activeUser = null;

videoInput.addEventListener('change', () => {
  document.querySelector('[data-file-name]').textContent = videoInput.files[0]?.name || 'No file selected';
});

function showMessage(element, text) {
  element.textContent = text;
}

function renderPlayerSubmissions(submissions) {
  const container = document.querySelector('#player-submissions');
  container.replaceChildren();
  if (!submissions.length) {
    container.textContent = 'Your coach-approved feedback will appear here after a review.';
    return;
  }

  submissions.forEach((submission) => {
    const article = document.createElement('article');
    article.className = 'workflow-result';
    const heading = document.createElement('h3');
    heading.textContent = submission.intake.video_title;
    const status = document.createElement('p');
    status.className = 'workflow-status';
    status.textContent = submission.status === 'published' ? 'COACH REVIEW COMPLETE' : 'WAITING FOR COACH REVIEW';
    article.append(heading, status);
    if (submission.final_feedback) {
      const feedback = document.createElement('p');
      feedback.textContent = submission.final_feedback;
      article.append(feedback);
    }
    container.append(article);
  });
}

async function loadPlayerSubmissions() {
  if (!activeUser) return;
  const { data, error } = await playerSupabase
    .from('player_submissions')
    .select('id,intake,status,final_feedback,created_at')
    .eq('user_id', activeUser.id)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Player feedback load failed:', error);
    return;
  }
  renderPlayerSubmissions(data || []);
}

function setPlayerSession(session) {
  activeUser = session?.user || null;
  intakeArea.hidden = !activeUser;
  loginForm.hidden = Boolean(activeUser);
  if (activeUser) {
    document.querySelector('#signed-in-email').textContent = activeUser.email || '';
    window.setTimeout(() => { loadPlayerSubmissions(); }, 0);
  }
}

function uploadVideo(file, storagePath, accessToken, onProgress) {
  return new Promise((resolve, reject) => {
    const upload = new tus.Upload(file, {
      endpoint: `${playerConfig.url}/storage/v1/upload/resumable`,
      retryDelays: [0, 3000, 5000, 10000, 20000],
      headers: {
        authorization: `Bearer ${accessToken}`,
        apikey: playerConfig.anonKey,
        'x-upsert': 'false',
      },
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      metadata: {
        bucketName: 'player-videos',
        objectName: storagePath,
        contentType: file.type,
        cacheControl: '3600',
      },
      onError: reject,
      onProgress: (sent, total) => onProgress(Math.round((sent / total) * 100)),
      onSuccess: resolve,
    });
    upload.start();
  });
}

if (!playerSupabase) {
  showMessage(loginMessage, 'Supabase is not configured. Add the publishable/anon key in supabase-config.js.');
  loginForm.querySelector('button').disabled = true;
} else {
  playerSupabase.auth.getSession().then(({ data }) => setPlayerSession(data.session));
  playerSupabase.auth.onAuthStateChange((_event, session) => setPlayerSession(session));
}

loginForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!playerSupabase) return;
  const email = new FormData(loginForm).get('email').toString().trim().toLowerCase();
  const button = loginForm.querySelector('[type="submit"]');
  button.disabled = true;
  showMessage(loginMessage, 'Sending your secure sign-in link…');
  const { error } = await playerSupabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
  showMessage(loginMessage, error ? 'We could not send the link. Check the email and Supabase Auth settings.' : 'Check your email for a secure sign-in link.');
  button.disabled = false;
});

document.querySelector('#sign-out').addEventListener('click', async () => {
  await playerSupabase.auth.signOut();
  renderPlayerSubmissions([]);
});

intakeForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!playerSupabase || !activeUser) {
    showMessage(intakeMessage, 'Sign in before submitting your performance intake.');
    return;
  }

  const formData = new FormData(intakeForm);
  const file = formData.get('video');
  if (!file || file.size < 1 || file.size > 100 * 1024 * 1024 || !['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
    showMessage(intakeMessage, 'Choose an MP4, MOV or WebM video under 100 MB.');
    return;
  }

  const submitButton = intakeForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  showMessage(intakeMessage, 'Uploading your intake and video… 0%');
  const submissionId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `${activeUser.id}/${submissionId}/${safeName}`;
  const fields = [
    'goal', 'macro_targets', 'food_pattern', 'weekly_training', 'training_fuel',
    'rest_day', 'hydration', 'supplements', 'recovery', 'habits', 'coach_focus', 'video_title',
  ];
  const intake = Object.fromEntries(fields.map((key) => [key, formData.get(key)?.toString().trim() || '']));
  intake.bodyweight_lb = formData.get('bodyweight_lb') ? Number(formData.get('bodyweight_lb')) : null;
  let uploadAttempted = false;

  try {
    const { data: sessionData } = await playerSupabase.auth.getSession();
    if (!sessionData.session) throw new Error('The sign-in session expired. Sign in again.');
    uploadAttempted = true;
    await uploadVideo(file, storagePath, sessionData.session.access_token, (percent) => {
      showMessage(intakeMessage, `Uploading your intake and video… ${percent}%`);
    });

    const { error: insertError } = await playerSupabase.from('player_submissions').insert({
      id: submissionId,
      user_id: activeUser.id,
      player_name: formData.get('player_name').toString().trim(),
      player_email: activeUser.email,
      consent_confirmed: formData.get('consent_confirmed') === 'on',
      intake,
      video_path: storagePath,
      video_content_type: file.type,
      video_size: file.size,
    });
    if (insertError) throw insertError;

    showMessage(intakeMessage, 'Submission saved. Preparing a private draft for your coach…');
    const { error: feedbackError } = await playerSupabase.functions.invoke('generate-coach-draft', {
      body: { submissionId },
    });
    intakeForm.reset();
    document.querySelector('[data-file-name]').textContent = 'No file selected';
    await loadPlayerSubmissions();
    showMessage(intakeMessage, feedbackError
      ? 'Your intake and video are saved. Your coach can review them; AI draft generation needs configuration.'
      : 'Your intake and video are with your coach. AI draft feedback is private to the coaching team.');
  } catch (error) {
    console.error('Player submission failed:', error);
    if (uploadAttempted) await playerSupabase.storage.from('player-videos').remove([storagePath]);
    showMessage(intakeMessage, 'We could not save your submission. Check your connection and Supabase setup, then try again.');
  } finally {
    submitButton.disabled = false;
  }
});