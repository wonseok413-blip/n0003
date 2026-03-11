// FAQ Accordion
document.querySelectorAll('.faq-question').forEach(function(btn) {
  btn.addEventListener('click', function() {
    const item = this.parentElement;
    const isActive = item.classList.contains('active');

    // Close all items
    document.querySelectorAll('.faq-item').forEach(function(el) {
      el.classList.remove('active');
      el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
    });

    // Open clicked item if it was closed
    if (!isActive) {
      item.classList.add('active');
      this.setAttribute('aria-expanded', 'true');
    }
  });
});

// Contact Form  Formspree submission with mailto fallback
document.getElementById('contactForm').addEventListener('submit', async function(e) {
  e.preventDefault();

  const submitButton = this.querySelector('button[type="submit"]');
  const originalButtonText = submitButton.innerHTML;

  submitButton.disabled = true;
  submitButton.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Sending...';

  const formData = new FormData(this);
  const data = Object.fromEntries(formData);

  const emailBody = `
New Contact Form Submission from Noteracker Website

Name: ${data.firstName} ${data.lastName}
Email: ${data.email}
Website: ${data.website || 'Not provided'}
Service: ${data.service}
Emergency: ${data.emergency ? 'YES - URGENT' : 'No'}

Message:
${data.message}

---
Submitted: ${new Date().toLocaleString()}
  `.trim();

  try {
    const response = await fetch('https://formspree.io/f/xreakael', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: data.email,
        name: `${data.firstName} ${data.lastName}`,
        message: emailBody,
        _replyto: data.email,
        _subject: data.emergency
          ? `🚨 EMERGENCY: ${data.service} - ${data.firstName} ${data.lastName}`
          : `Contact Form: ${data.service} - ${data.firstName} ${data.lastName}`
      })
    });

    if (response.ok) {
      submitButton.innerHTML = '<i class="fa-solid fa-circle-check"></i> Message Sent!';
      submitButton.style.backgroundColor = '#899e2e';

      alert(`Thank you ${data.firstName}! Your message has been sent successfully. We'll get back to you ${data.emergency ? 'ASAP (usually within 1-3 hours for emergencies)' : 'within 24 hours'}.`);

      this.reset();

      setTimeout(() => {
        submitButton.disabled = false;
        submitButton.innerHTML = originalButtonText;
        submitButton.style.backgroundColor = '';
      }, 3000);

    } else {
      throw new Error('Form submission failed');
    }

  } catch (error) {
    console.error('Form submission error:', error);

    const mailtoSubject = data.emergency
      ? `EMERGENCY: ${data.service} - ${data.firstName} ${data.lastName}`
      : `Contact Form: ${data.service} - ${data.firstName} ${data.lastName}`;

    const mailtoLink = `mailto:support@noteracker.com?subject=${encodeURIComponent(mailtoSubject)}&body=${encodeURIComponent(emailBody)}`;

    if (confirm('There was an issue submitting the form. Would you like to open your email client instead?')) {
      window.location.href = mailtoLink;
    }

    submitButton.disabled = false;
    submitButton.innerHTML = originalButtonText;
  }
});
