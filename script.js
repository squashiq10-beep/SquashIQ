const supabaseConfig = window.SQUASHIQ_SUPABASE_CONFIG || {};
const supabaseClient = window.supabase && supabaseConfig.url && supabaseConfig.anonKey
  ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
  : null;
const form = document.querySelector('#pilot-form');
const message = document.querySelector('.form-message');

async function savePilotRequest(email) {
  if (!supabaseClient) {
    console.warn('Supabase client is not available.');
    return false;
  }

  try {
    const { error } = await supabaseClient
      .from('pilot_waitlist')
      .insert([
        {
          email,
          created_at: new Date().toISOString(),
        },
      ]);

    if (error) {
      console.error('Supabase insert failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Supabase request error:', error);
    return false;
  }
}

form?.addEventListener('submit', async (event) => {
  event.preventDefault();
  const email = (new FormData(form).get('email') || '').toString().trim();

  if (!email) {
    message.textContent = 'Please enter a valid email address.';
    return;
  }

  const saved = await savePilotRequest(email);
  message.textContent = saved
    ? `Invite request saved for ${email}.`
    : 'We could not save your request. Check the Supabase setup and try again.';

  if (saved) form.reset();
});

document.querySelectorAll('.step').forEach((step) => {
  step.addEventListener('click', () => {
    document.querySelectorAll('.step').forEach((item) => item.classList.remove('active'));
    step.classList.add('active');
  });
});
