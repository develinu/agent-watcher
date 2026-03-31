# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x   | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do NOT** open a public GitHub issue
2. Email **iwlee.dev@gmail.com** with:
   - Description of the vulnerability
   - Steps to reproduce
   - Potential impact
3. You will receive a response within **48 hours**
4. A fix will be developed and released as soon as possible

## Security Best Practices

When using Agent Watcher:

- Never commit your `.env` file (it is in `.gitignore` by default)
- Rotate API keys regularly
- Use environment variables for all secrets
- Run the application behind a reverse proxy in production
