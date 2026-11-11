const feedbackForm = document.querySelector('#website-feedback-form');
const feedbackMessage = document.querySelector('#feedback-message');

if (feedbackForm) {
  feedbackForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(feedbackForm);
    const ease = formData.get('ease');
    const usefulness = Number(formData.get('usefulness')) || 0;
    const improvements = formData.get('improvements').toString().trim();
    const liked = formData.get('liked').toString().trim();

    if (!ease || !usefulness || !improvements) {
      feedbackMessage.textContent = 'Please complete the required fields so we can understand your feedback.';
      return;
    }

    const summary = `Thanks for the feedback. Your rating suggests the experience felt ${ease.replace('-', ' ')} and ${usefulness}/10 useful.`;
    const note = liked ? `You especially liked: ${liked}` : 'We appreciate the honest feedback and will keep improving the experience.';

    feedbackMessage.textContent = `${summary} ${note}`;
    feedbackForm.reset();
  });
}
