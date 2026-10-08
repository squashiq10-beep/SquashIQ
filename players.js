const videoConfig = window.SQUASHIQ_SUPABASE_CONFIG || {};
const videoSupabase = window.supabase && videoConfig.url && videoConfig.anonKey
  ? window.supabase.createClient(videoConfig.url, videoConfig.anonKey)
  : null;
const videoForm = document.querySelector('#video-form');
const videoMessage = document.querySelector('.app-message');
const videoInput = videoForm.elements.video;

videoInput.addEventListener('change', () => {
  document.querySelector('[data-file-name]').textContent = videoInput.files[0]?.name || 'No file selected';
});

videoForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(videoForm);
  const file = formData.get('video');
  const email = formData.get('email').toString().trim().toLowerCase();
  const message = (text) => { videoMessage.textContent = text; };

  if (!videoSupabase) {
    message('Supabase is not configured. Add the publishable/anon key in supabase-config.js.');
    return;
  }
  if (!file || file.size > 100 * 1024 * 1024 || !['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) {
    message('Choose an MP4, MOV or WebM video under 100 MB.');
    return;
  }

  const submitButton = videoForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  message('Uploading video…');
  const videoId = crypto.randomUUID();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
  const storagePath = `${videoId}/${safeName}`;

  try {
    const { error: uploadError } = await videoSupabase.storage
      .from('player-videos')
      .upload(storagePath, file, { contentType: file.type, upsert: false });

    if (uploadError) throw uploadError;

    const { error: insertError } = await videoSupabase.from('player_videos').insert({
      id: videoId,
      player_name: formData.get('full_name').toString().trim(),
      player_email: email,
      title: formData.get('title').toString().trim(),
      notes: formData.get('notes').toString().trim() || null,
      storage_path: storagePath,
      content_type: file.type,
      file_size: file.size,
    });

    if (insertError) throw insertError;
    message('Video uploaded. Your coach can review it from the private player library.');
    videoForm.reset();
    document.querySelector('[data-file-name]').textContent = 'No file selected';
  } catch (error) {
    console.error('Video submission failed:', error);
    message('We could not save this video. Check your connection and Supabase setup, then try again.');
  } finally {
    submitButton.disabled = false;
  }
});