const coachConfig = window.SQUASHIQ_SUPABASE_CONFIG || {};
const coachSupabase = window.supabase && coachConfig.url && coachConfig.anonKey
  ? window.supabase.createClient(coachConfig.url, coachConfig.anonKey)
  : null;
const coachLogin = document.querySelector('#coach-login');
const coachWorkspace = document.querySelector('#coach-workspace');
const coachLoginMessage = document.querySelector('#coach-login-message');
const workspaceMessage = document.querySelector('#coach-workspace-message');
let coachUser = null;

function setCoachMessage(text) {
  workspaceMessage.textContent = text;
}

function titleCase(value) {
  return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function addIntakeDetails(container, intake) {
  const details = document.createElement('dl');
  details.className = 'workflow-intake';
  Object.entries(intake).forEach(([key, value]) => {
    if (value === '' || value === null || value === undefined) return;
    const term = document.createElement('dt');
    term.textContent = titleCase(key);
    const description = document.createElement('dd');
    description.textContent = typeof value === 'number' ? `${value} lb` : String(value);
    details.append(term, description);
  });
  container.append(details);
}

async function loadCoachSubmissions() {
  setCoachMessage('Loading player submissions…');
  const { data: membership, error: membershipError } = await coachSupabase
    .from('coach_users')
    .select('user_id')
    .eq('user_id', coachUser.id)
    .maybeSingle();
  if (membershipError || !membership) {
    setCoachMessage('This account is not authorized as a coach. Ask an administrator to grant coach access.');
    document.querySelector('#coach-submissions').replaceChildren();
    return;
  }

  const { data: submissions, error } = await coachSupabase
    .from('player_submissions')
    .select('id,user_id,player_name,player_email,intake,video_path,status,final_feedback,created_at')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('Coach submissions load failed:', error);
    setCoachMessage('Submissions could not be loaded. Check the Supabase policies and setup.');
    return;
  }

  const container = document.querySelector('#coach-submissions');
  container.replaceChildren();
  if (!submissions?.length) {
    setCoachMessage('No player submissions yet.');
    return;
  }
  setCoachMessage(`${submissions.length} player submission${submissions.length === 1 ? '' : 's'}.`);

  const { data: drafts, error: draftError } = await coachSupabase
    .from('coach_ai_drafts')
    .select('submission_id,ai_draft,created_at');
  if (draftError) console.error('Coach AI drafts load failed:', draftError);
  const draftsBySubmission = new Map((drafts || []).map((draft) => [draft.submission_id, draft]));

  for (const submission of submissions) {
    const article = document.createElement('article');
    article.className = 'workflow-coach-submission';
    const heading = document.createElement('h2');
    heading.textContent = submission.player_name;
    const meta = document.createElement('p');
    meta.className = 'workflow-status';
    meta.textContent = `${submission.player_email} · ${new Date(submission.created_at).toLocaleString()} · ${submission.status.replace('_', ' ').toUpperCase()}`;
    article.append(heading, meta);

    const { data: video, error: videoError } = await coachSupabase.storage
      .from('player-videos')
      .createSignedUrl(submission.video_path, 3600);
    if (videoError) {
      const errorText = document.createElement('p');
      errorText.textContent = 'Video preview is unavailable. Check coach storage access.';
      article.append(errorText);
    } else {
      const player = document.createElement('video');
      player.className = 'workflow-video';
      player.controls = true;
      player.preload = 'metadata';
      player.src = video.signedUrl;
      player.setAttribute('aria-label', `Squash video submitted by ${submission.player_name}`);
      article.append(player);
    }

    const intakeHeading = document.createElement('h3');
    intakeHeading.textContent = 'Player intake';
    article.append(intakeHeading);
    addIntakeDetails(article, submission.intake);

    const draftHeading = document.createElement('h3');
    draftHeading.textContent = 'Private AI draft';
    article.append(draftHeading);
    const draftContent = document.createElement('p');
    draftContent.className = 'workflow-ai-draft';
    draftContent.textContent = draftsBySubmission.get(submission.id)?.ai_draft || 'No AI draft is available. Review the intake and add your coaching feedback below.';
    article.append(draftContent);

    const feedbackForm = document.createElement('form');
    feedbackForm.className = 'app-form workflow-feedback-form';
    const feedbackLabel = document.createElement('label');
    feedbackLabel.className = 'field';
    const labelText = document.createElement('span');
    labelText.textContent = 'FINAL COACH FEEDBACK';
    const feedbackInput = document.createElement('textarea');
    feedbackInput.name = 'final_feedback';
    feedbackInput.rows = 5;
    feedbackInput.maxLength = 5000;
    feedbackInput.required = true;
    feedbackInput.value = submission.final_feedback || '';
    feedbackLabel.append(labelText, feedbackInput);
    const publishButton = document.createElement('button');
    publishButton.className = 'button button-lime app-submit';
    publishButton.type = 'submit';
    publishButton.textContent = submission.status === 'published' ? 'Update player feedback' : 'Publish to player';
    const formMessage = document.createElement('p');
    formMessage.className = 'app-message';
    formMessage.setAttribute('role', 'status');
    feedbackForm.append(feedbackLabel, publishButton, formMessage);
    feedbackForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const finalFeedback = feedbackInput.value.trim();
      if (!finalFeedback) return;
      publishButton.disabled = true;
      formMessage.textContent = 'Saving coach feedback…';
      const { error: updateError } = await coachSupabase
        .from('player_submissions')
        .update({
          final_feedback: finalFeedback,
          status: 'published',
          coach_id: coachUser.id,
          coach_updated_at: new Date().toISOString(),
        })
        .eq('id', submission.id);
      formMessage.textContent = updateError ? 'Feedback could not be saved. Check coach permissions and try again.' : 'Coach feedback published to the player.';
      publishButton.disabled = false;
      if (updateError) console.error('Coach feedback publish failed:', updateError);
    });
    article.append(feedbackForm);
    container.append(article);
  }
}

function setSession(session) {
  coachUser = session?.user || null;
  coachWorkspace.hidden = !coachUser;
  coachLogin.hidden = Boolean(coachUser);
  if (coachUser) {
    document.querySelector('#coach-email').textContent = coachUser.email || '';
    window.setTimeout(() => { loadCoachSubmissions(); }, 0);
  }
}

if (!coachSupabase) {
  coachLoginMessage.textContent = 'Supabase is not configured. Add the publishable/anon key in supabase-config.js.';
  coachLogin.querySelector('button').disabled = true;
} else {
  coachSupabase.auth.getSession().then(({ data }) => setSession(data.session));
  coachSupabase.auth.onAuthStateChange((_event, session) => setSession(session));
}

coachLogin.addEventListener('submit', async (event) => {
  event.preventDefault();
  if (!coachSupabase) return;
  const email = new FormData(coachLogin).get('email').toString().trim().toLowerCase();
  const button = coachLogin.querySelector('[type="submit"]');
  button.disabled = true;
  coachLoginMessage.textContent = 'Sending your secure sign-in link…';
  const { error } = await coachSupabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: window.location.href.split('#')[0] },
  });
  coachLoginMessage.textContent = error ? 'We could not send the link. Check the email and Supabase Auth settings.' : 'Check your email for a secure sign-in link.';
  button.disabled = false;
});

document.querySelector('#coach-sign-out').addEventListener('click', async () => {
  await coachSupabase.auth.signOut();
  document.querySelector('#coach-submissions').replaceChildren();
});