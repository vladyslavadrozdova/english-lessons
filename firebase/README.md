# Firebase setup for Wheel of Skills

The page `lessons/wheel-of-skills.html` stores its shared state in Cloud
Firestore at `wheels/shared-wheel` and signs visitors in anonymously.

Firebase Console setup:

1. Enable Authentication > Sign-in method > Anonymous.
2. Create a Cloud Firestore database in production mode.
3. Open Firestore Database > Rules, replace the editor contents with
   `firestore.rules`, and publish the rules.

The GitHub Pages site remains the frontend host. Firebase Hosting is not used.
