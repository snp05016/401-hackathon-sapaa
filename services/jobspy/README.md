# JobSpy discovery service

This local FastAPI sidecar follows the MIT-licensed
[JobTrail](https://github.com/kaylaehman/jobtrail) architecture and calls the
MIT-licensed [JobSpy](https://github.com/speedyapply/JobSpy) package. It keeps
Python scraping out of Electron's renderer and caches matching searches for ten
minutes.

The Electron desktop application starts this service automatically. On first
launch it creates `services/jobspy/.venv` and installs the pinned packages in
`requirements.txt`; later launches reinstall only when that file changes.
Python 3.10 through 3.13 must be installed locally.

For standalone development, run `npm run dev:jobspy`. Set `JOBSPY_URL` when the
sidecar runs somewhere other than `http://127.0.0.1:8001`; a custom URL disables
automatic local startup.

Use small searches and review each source's terms before production use. This
service does not bypass authentication, CAPTCHA, paywalls, or anti-bot controls.
