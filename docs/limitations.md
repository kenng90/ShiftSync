# Known limitations

- Email is simulated to the API console when a user chooses “in-app + email.” No SMTP provider is wired.
- There is no mobile-native app; the web UI is responsive but built for desktop-first manager workflows.
- Recurring availability is weekly windows plus date exceptions, not a full calendar of rotating patterns.
- Concurrent assign uses a short MySQL row lock plus Socket.io; it is not a distributed Redis lock.
- Production deploy expects a MySQL instance and env vars from `.env.example`. The public URL should be added to the README after you host it. Render’s free web plan has no Shell; migrations run on boot.
