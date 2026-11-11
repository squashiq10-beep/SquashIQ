const reviewForm = document.querySelector('#review-form');
const reviewMessage = document.querySelector('#review-message');
const reviewOutput = document.querySelector('#review-output');
const reviewSummary = document.querySelector('#review-summary');
const reviewPoints = document.querySelector('#review-points');

function buildReviewFeedback(formData) {
  const goal = formData.get('goal');
  const status = formData.get('goal_status');
  const wins = formData.get('wins').toString().trim();
  const obstacles = formData.get('obstacles').toString().trim();
  const confidence = Number(formData.get('confidence')) || 0;
  const nextStep = formData.get('next_step').toString().trim();

  const statusMessage = {
    achieved: 'You met the target this week. That is a strong signal that the current structure is working.',
    partial: 'You made progress this week, but the plan still needs a little more structure or consistency.',
    missed: 'This week did not match the goal yet, and that is useful information. The next step is to simplify the plan.',
  }[status];

  const focusAdvice = {
    consistency: 'Keep routines simple and repeatable. Reduce decisions and protect sleep and recovery.',
    fitness: 'Prioritise quality effort over volume. Keep intensity controlled and make recovery non-negotiable.',
    movement: 'Tighten the movement patterns that support balance, split steps, and recovery to the T.',
    skills: 'Keep the skill block short and repeatable. Focus on one technical cue at a time with a clean rhythm.',
  }[goal];

  const summary = `${statusMessage} Your confidence level is ${confidence}/10, and the clearest next move is to ${nextStep || 'refine the routine so the essentials are easier to repeat.'}`;

  const bulletPoints = [
    wins ? `Your strongest win this week was: ${wins}` : 'Your review would be stronger with one specific win you want to repeat.',
    obstacles ? `The biggest blocker was: ${obstacles}` : 'The main blocker was not documented yet, so make sure to name it next time.',
    focusAdvice,
    confidence >= 7 ? 'You have enough momentum to stay with the plan and raise the standard slightly.' : 'Your current confidence suggests the plan should be simplified and executed more consistently.',
  ];

  return { summary, bulletPoints };
}

if (reviewForm) {
  reviewForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(reviewForm);
    const goal = formData.get('goal');
    const status = formData.get('goal_status');
    if (!goal || !status) {
      reviewMessage.textContent = 'Choose a weekly goal and a goal status before generating the review.';
      return;
    }

    const feedback = buildReviewFeedback(formData);
    reviewSummary.textContent = feedback.summary;
    reviewPoints.replaceChildren(...feedback.bulletPoints.map((point) => {
      const item = document.createElement('li');
      item.textContent = point;
      return item;
    }));
    reviewOutput.hidden = false;
    reviewMessage.textContent = 'AI review generated. Use this summary to shape your next week.';
  });
}
