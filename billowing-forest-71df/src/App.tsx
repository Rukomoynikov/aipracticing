import { type FC } from "react";
import Header from "./components/Header";
import Hero from "./components/Hero";
import WhatWeDo from "./components/WhatWeDo";
import WhoItsFor from "./components/WhoItsFor";
import HowItWorks from "./components/HowItWorks";
import MeetingDetails from "./components/MeetingDetails";
import NextEvent, { type EventData, type CurrentUser } from "./components/NextEvent";
import Footer from "./components/Footer";

const formScript = `
(function() {
  var form = document.getElementById('signupForm');
  var status = document.getElementById('formStatus');

  if (!form || !status) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    status.textContent = 'Submitting...';

    var data = new FormData(form);

    try {
      var res = await fetch(form.action || '/api/signup', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      var contentType = res.headers.get('Content-Type') || '';
      var payload = null;

      if (contentType.includes('application/json')) {
        payload = await res.json();
      }

      if (!res.ok || !(payload && payload.ok)) {
        var errorMessage =
          (payload && (payload.error || payload.message)) ||
          'Something went wrong. Please try again.';
        status.textContent = errorMessage;
        return;
      }

      var copy = document.getElementById('signupCopy');
      if (copy) copy.style.display = 'none';
      form.style.display = 'none';
      var card = document.getElementById('signup');
      if (card) card.style.display = 'flex';
      var success = document.getElementById('signupSuccess');
      if (success) success.classList.add('visible');
      form.reset();
    } catch (err) {
      console.error(err);
      status.textContent =
        "Thanks — you're in! If this message repeats, refresh and try again, or email us directly.";
    }
  });
})();
`;

const eventSignupScript = `
(function() {
  var form = document.getElementById('eventSignupForm');
  if (!form) return;

  form.addEventListener('submit', async function(e) {
    e.preventDefault();

    var status = document.getElementById('eventSignupStatus');
    var btn = form.querySelector('button[type=submit]');
    var eventId = form.getAttribute('data-event-id');

    if (status) status.textContent = 'Submitting...';
    if (btn) btn.disabled = true;

    var data = new FormData(form);

    try {
      var res = await fetch('/api/events/' + eventId + '/signup', {
        method: 'POST',
        body: data,
        headers: { Accept: 'application/json' },
      });

      var payload = null;
      var contentType = res.headers.get('Content-Type') || '';
      if (contentType.includes('application/json')) {
        payload = await res.json();
      }

      if (!res.ok || !(payload && payload.ok)) {
        var errorMessage =
          (payload && (payload.error || payload.message)) ||
          'Something went wrong. Please try again.';
        if (status) status.textContent = errorMessage;
        if (btn) btn.disabled = false;
        return;
      }

      form.style.display = 'none';
      var success = document.getElementById('eventSignupSuccess');
      if (success) success.style.display = 'flex';
    } catch (err) {
      console.error(err);
      if (status) status.textContent = 'Something went wrong. Please try again.';
      if (btn) btn.disabled = false;
    }
  });
})();
`;

const App: FC<{
  isAuthenticated?: boolean;
  nextEvent?: EventData | null;
  currentUser?: CurrentUser | null;
  isSignedUp?: boolean;
}> = ({ isAuthenticated, nextEvent, currentUser, isSignedUp }) => (
  <html lang="en">
    <head>
      <meta charSet="UTF-8" />
      <meta name="viewport" content="width=device-width" />
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <title>AI Together — London AI practice club</title>
      <meta
        name="description"
        content="A small, friendly London community (10–15 people) meeting fortnightly to practice AI tools together. Beginner-friendly, free, and hands-on."
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      <link
        href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&display=swap"
        rel="stylesheet"
      />
      <link rel="stylesheet" href="/styles.css" />
      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://aitogether.club" />
      <meta property="og:title" content="AI Together — London AI practice club" />
      <meta property="og:description" content="A small, friendly London community (10–15 people) meeting fortnightly to practice AI tools together. Beginner-friendly, free, and hands-on." />
      <meta property="og:image" content="https://aitogether.club/og-image.png" />
      {/* Twitter */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:url" content="https://aitogether.club" />
      <meta name="twitter:title" content="AI Together — London AI practice club" />
      <meta name="twitter:description" content="A small, friendly London community (10–15 people) meeting fortnightly to practice AI tools together. Beginner-friendly, free, and hands-on." />
      <meta name="twitter:image" content="https://aitogether.club/og-image.png" />
    </head>
    <body>
      <div className="page">
        <Header isAuthenticated={isAuthenticated} />
        <main id="top" className="main">
          <Hero />
          <WhatWeDo />
          <WhoItsFor />
          <HowItWorks />
          <MeetingDetails />
          {nextEvent && (
            <NextEvent event={nextEvent} currentUser={currentUser ?? null} isSignedUp={isSignedUp ?? false} />
          )}
        </main>
        <Footer />
      </div>
      <script dangerouslySetInnerHTML={{ __html: formScript }} />
      {nextEvent && (
        <script dangerouslySetInnerHTML={{ __html: eventSignupScript }} />
      )}
    </body>
  </html>
);

export default App;
