# JobSpy discovery service

This local FastAPI sidecar follows the MIT-licensed
[JobTrail](https://github.com/kaylaehman/jobtrail) architecture and calls the
MIT-licensed [JobSpy](https://github.com/speedyapply/JobSpy) package. It keeps
Python scraping out of Electron's renderer and caches matching searches for ten
minutes.

```sh
python3 -m venv .venv
. .venv/bin/activate
pip install -r services/jobspy/requirements.txt
npm run dev:jobspy
```

In a second terminal, run `npm run dev`. Set `JOBSPY_URL` when the sidecar runs
somewhere other than `http://127.0.0.1:8001`.

Use small searches and review each source's terms before production use. This
service does not bypass authentication, CAPTCHA, paywalls, or anti-bot controls.
