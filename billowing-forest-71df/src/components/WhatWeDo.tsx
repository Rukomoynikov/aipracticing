import { type FC } from "react";

const WhatWeDo: FC = () => (
  <section id="what" className="section">
    <div className="section-head">
      <h2 className="h2">What we do</h2>
      <p className="sub">
        A practical meetup for learning by doing — you'll leave with ideas you can use the same
        day.
      </p>
    </div>

    <div className="cards">
      <article className="card">
        <div className="card-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M4 7.5C4 6.12 5.12 5 6.5 5H17.5C18.88 5 20 6.12 20 7.5V16.5C20 17.88 18.88 19 17.5 19H6.5C5.12 19 4 17.88 4 16.5V7.5Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M8 9H16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M8 13H13"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="h3">Hands-on workshops</h3>
        <p>
          Practice tools like ChatGPT, Claude, Midjourney, and others — with real prompts, real
          results, and time to try your own ideas.
        </p>
      </article>

      <article className="card">
        <div className="card-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3L20 8V16L12 21L4 16V8L12 3Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinejoin="round"
            />
            <path
              d="M12 7V17"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M7.5 10.2L12 12.8L16.5 10.2"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="h3">Group challenges</h3>
        <p>
          Tiny collaborative projects that make it fun: shared briefs, prompt battles, rapid
          prototyping, and "show &amp; tell" moments.
        </p>
      </article>

      <article className="card">
        <div className="card-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M7 10.5C7 8.01 9.01 6 11.5 6H15C17.21 6 19 7.79 19 10V10"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M17 13.5C17 15.99 14.99 18 12.5 18H9C6.79 18 5 16.21 5 14V14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M9 12H15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <h3 className="h3">Sharing prompts &amp; workflows</h3>
        <p>
          Bring what you've discovered: your best prompts, shortcuts, and "aha" moments — so the
          group gets better, faster.
        </p>
      </article>

      <article className="card">
        <div className="card-ico" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 21C16.97 21 21 16.97 21 12C21 7.03 16.97 3 12 3C7.03 3 3 7.03 3 12C3 16.97 7.03 21 12 21Z"
              stroke="currentColor"
              strokeWidth="2"
            />
            <path
              d="M12 8V12L15 14"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h3 className="h3">Beginner-friendly pace</h3>
        <p>
          No jargon, no judgement. If you're curious, you're ready. We'll pair up, troubleshoot,
          and keep things easy to follow.
        </p>
      </article>
    </div>
  </section>
);

export default WhatWeDo;
