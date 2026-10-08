const scheduleConfig = window.SQUASHIQ_SUPABASE_CONFIG || {};
const scheduleSupabase = window.supabase && scheduleConfig.url && scheduleConfig.anonKey
  ? window.supabase.createClient(scheduleConfig.url, scheduleConfig.anonKey)
  : null;
const profileForm = document.querySelector('#profile-form');
const profileMessage = document.querySelector('#profile-message');
const generator = document.querySelector('#schedule-generator');
const generateButton = document.querySelector('#generate-schedule');
const scheduleMessage = document.querySelector('#schedule-message');
let savedProfile = null;

profileForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const formData = new FormData(profileForm);
  const trainingDays = formData.getAll('training_days');
  if (trainingDays.length < 2 || trainingDays.length > 5) {
    profileMessage.textContent = 'Choose between 2 and 5 training days.';
    return;
  }
  if (!scheduleSupabase) {
    profileMessage.textContent = 'Supabase is not configured. Add the publishable/anon key in supabase-config.js.';
    return;
  }

  const submitButton = profileForm.querySelector('[type="submit"]');
  submitButton.disabled = true;
  profileMessage.textContent = 'Saving player details…';
  const profileId = crypto.randomUUID();
  const profile = {
    id: profileId,
    full_name: formData.get('full_name').toString().trim(),
    email: formData.get('email').toString().trim().toLowerCase(),
    age: Number(formData.get('age')),
    skill_level: formData.get('skill_level'),
    goal: formData.get('goal'),
    training_days: trainingDays,
  };

  try {
    const { error } = await scheduleSupabase.from('player_profiles').insert(profile);
    if (error) throw error;
    savedProfile = profile;
    profileMessage.textContent = 'Details saved. Your schedule generator is ready.';
    generator.hidden = false;
    generateButton.disabled = false;
  } catch (error) {
    console.error('Player profile save failed:', error);
    profileMessage.textContent = 'We could not save your details. Check your connection and Supabase setup, then try again.';
  } finally {
    submitButton.disabled = false;
  }
});

function createSchedule(profile) {
  const activities = {
    balanced: [
      ['Court movement', 'Warm up, then work on split steps, ghosting and controlled recovery to the T.'],
      ['Racket skills', 'Build straight drives and length with a relaxed grip and consistent contact.'],
      ['Match play', 'Play focused games and choose one tactical intention for each game.'],
      ['Strength and mobility', 'Use coach-approved full-body strength work, then finish with easy mobility.'],
      ['Conditioning', 'Alternate short court intervals with generous recovery between efforts.'],
    ],
    'match-fitness': [
      ['Court intervals', 'Alternate purposeful ghosting intervals with easy recovery. Keep your movement controlled.'],
      ['Racket skills', 'Practise length and accuracy while maintaining relaxed, repeatable movement.'],
      ['Conditioning', 'Use short court intervals at a steady effort, with full recovery between sets.'],
      ['Match play', 'Play practice games and note how you manage pace between rallies.'],
      ['Easy recovery', 'Take a relaxed walk or gentle mobility session and keep the effort light.'],
    ],
    movement: [
      ['Movement technique', 'Work on split steps, balanced lunges and returning to the T under control.'],
      ['Ghosting patterns', 'Practise short, deliberate corner-to-corner patterns with full recovery.'],
      ['Racket skills', 'Pair controlled movement with straight drives and repeatable contact.'],
      ['Court movement', 'Use coach-selected movement patterns and focus on balance after each shot.'],
      ['Easy recovery', 'Take a relaxed walk or gentle mobility session and keep the effort light.'],
    ],
    'racket-skills': [
      ['Straight drives', 'Build repeatable length on both sides; pause to reset your setup and contact.'],
      ['Serve and return', 'Practise a small set of reliable serves, then work on controlled returns.'],
      ['Racket skills', 'Alternate straight drives, boasts and volleys at a pace that preserves accuracy.'],
      ['Conditioned games', 'Play short games with one technical focus and review the pattern with your coach.'],
      ['Easy recovery', 'Take a relaxed walk or gentle mobility session and keep the effort light.'],
    ],
  };
  const plan = activities[profile.goal] || activities.balanced;
  return profile.training_days.map((day, index) => ({
    day,
    focus: plan[index % plan.length][0],
    details: plan[index % plan.length][1],
    duration_minutes: 45,
  }));
}

function renderSchedule(sessions) {
  const results = document.querySelector('#schedule-results');
  results.replaceChildren();
  sessions.forEach((session, index) => {
    const article = document.createElement('article');
    article.className = 'schedule-session';
    const day = document.createElement('span');
    day.className = 'session-day';
    day.textContent = session.day;
    const number = document.createElement('span');
    number.className = 'session-number';
    number.textContent = `SESSION 0${index + 1}`;
    const focus = document.createElement('h3');
    focus.textContent = session.focus;
    const details = document.createElement('p');
    details.textContent = session.details;
    const duration = document.createElement('small');
    duration.textContent = `${session.duration_minutes} MIN DRAFT`;
    article.append(day, number, focus, details, duration);
    results.append(article);
  });
}

generateButton.addEventListener('click', async () => {
  if (!savedProfile || !scheduleSupabase) return;
  generateButton.disabled = true;
  scheduleMessage.textContent = 'Generating and saving your schedule…';
  const sessions = createSchedule(savedProfile);
  const schedule = {
    profile_id: savedProfile.id,
    goal: savedProfile.goal,
    sessions,
  };

  try {
    const { error } = await scheduleSupabase.from('player_schedules').insert(schedule);
    if (error) throw error;
    renderSchedule(sessions);
    scheduleMessage.textContent = 'Schedule generated and saved for you and your coach to review.';
  } catch (error) {
    console.error('Schedule save failed:', error);
    scheduleMessage.textContent = 'We could not save the schedule. Check your connection and try again.';
  } finally {
    generateButton.disabled = false;
  }
});