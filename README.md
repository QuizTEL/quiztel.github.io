# QuizTEL — NPTEL Course Assessment & Quiz Platform

QuizTEL is a modern, lightweight, responsive web application for studying NPTEL course assignment questions and taking interactive, randomized practice quizzes.

---

## Features

- **Study Mode**: Browse questions week-by-week with verified answers and clear explanations highlighted inline.
- **Interactive Quiz Engine**:
  - Week coverage: Single week, multiple weeks, or All Weeks.
  - 4 Randomization Modes:
    1. **Normal**: Original question and option order.
    2. **Mixed Questions Only**: Shuffled questions, original option order.
    3. **Mixed Options Only**: Original question order, shuffled A/B/C/D option order.
    4. **Mixed Both**: Shuffled questions AND shuffled options.
  - Interactive test interface with progress bar and answer review scorecard.
- **Admin Panel**:
  - Secure login using Firebase Authentication (Email/Password).
  - Complete CMS to create/delete Courses, Weeks, and Questions.
  - **Bulk Document Import**: Upload `.pdf` or `.docx` files. Client-side extraction via `pdf.js` and `mammoth.js` automatically parses questions and batch-saves them to Firestore.
- **Live Analytics**: Real-time tracking of Total Page Views, Unique Visitors, and Quiz Attempts.

---

## File Structure

```
/WEBSITE
├── index.html              # Landing page (hero, course list, analytics summary)
├── study.html              # Study Mode interface
├── quiz.html               # Interactive Quiz Engine
├── admin.html              # Admin Control Panel (Auth, CMS, Bulk Import, Analytics)
├── css/
│   └── style.css           # Custom styles extending Tailwind CSS Play CDN
├── js/
│   ├── firebase-config.js  # Firebase Initialization (exports db & auth)
│   ├── analytics.js        # Traffic & quiz attempts counter module
│   ├── app.js              # Shared utilities & Firestore data loaders
│   ├── study.js            # Study Mode logic
│   ├── quiz.js             # Quiz Engine state machine & shuffle logic
│   ├── admin.js            # Admin Auth, CRUD, batch import & live analytics
│   └── file-parser.js      # Client-side PDF.js & Mammoth.js parsing logic
└── README.md               # Setup and deployment documentation
```

---

## Firebase Setup Guide

To run QuizTEL with live persistent production data, follow these steps:

### 1. Create a Firebase Project
1. Go to the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project**, enter a name (e.g., `QuizTEL`), and complete project creation.

### 2. Configure Firebase Web App Credentials
1. In your Firebase Project Overview, click the **Web icon (`</>`)** to add an app.
2. Enter an App nickname (e.g., `QuizTEL-Web`).
3. Copy the `firebaseConfig` object provided by Firebase.
4. Open `js/firebase-config.js` in your editor and paste your credentials into the `firebaseConfig` object:

```js
const firebaseConfig = {
  apiKey: "YOUR_ACTUAL_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### 3. Enable Firebase Authentication
1. In the Firebase Console sidebar, go to **Build** → **Authentication**.
2. Click **Get Started**.
3. Under Sign-in method, choose **Email/Password** and click **Enable**.
4. Switch to the **Users** tab and click **Add User** to create your Admin credentials (e.g., `admin@quiztel.com` and a secure password).

### 4. Enable Cloud Firestore Database
1. Go to **Build** → **Firestore Database**.
2. Click **Create Database**, select a region close to your target users, and select **Start in production mode**.
3. Once created, go to the **Rules** tab and paste the following security rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Analytics collection — public counter access
    match /analytics/{doc} {
      allow read, write: if true;
    }

    // Courses collection hierarchy — public read, authenticated admin write
    match /courses/{courseId} {
      allow read: if true;
      allow write: if request.auth != null;

      match /weeks/{weekId} {
        allow read: if true;
        allow write: if request.auth != null;

        match /questions/{questionId} {
          allow read: if true;
          allow write: if request.auth != null;
        }
      }
    }
  }
}
```
4. Click **Publish**.

---

## Bulk Import Document Format

The document parser (`js/file-parser.js`) scans PDF or DOCX text for structured question blocks. Ensure your uploaded assignment files follow this clean pattern:

```text
Q: What is Cloud Computing?
A) On-demand availability of computer system resources
B) A physical hard drive
C) Local server network
D) None of the above
Answer: A
Explanation: Cloud computing provides on-demand IT resources over the internet.

Q: Which of the following is an example of IaaS?
A) Google Docs
B) Amazon EC2
C) Salesforce
D) Heroku
Answer: B
Explanation: Amazon EC2 provides virtualized server infrastructure (IaaS).
```

---

## Deployment Instructions

### Deploying to GitHub Pages
1. Push this repository to GitHub.
2. In your repository on GitHub, go to **Settings** → **Pages**.
3. Under **Build and deployment**, select **Deploy from a branch**.
4. Choose the `main` (or `master`) branch and set directory to `/ (root)`.
5. Click **Save**. Your site will be live at `https://<username>.github.io/<repo-name>/`.

### Deploying to Vercel
1. Install Vercel CLI (`npm i -g vercel`) or import your repository directly via the [Vercel Dashboard](https://vercel.com).
2. Root Directory: `./` (leave default).
3. Build Command: (Leave empty — static site).
4. Output Directory: (Leave empty — root).
5. Click **Deploy**.

---

## License & Copyright

© 2026 QuizTEL. All rights reserved.
