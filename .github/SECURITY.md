# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |
| < 1.0   | :x:                |

## Reporting a Vulnerability

We take the security of FANZ MoneyDash seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them via email to security@fanz.network or through GitHub's private vulnerability reporting feature.

Please include the following information in your report:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

### Response Timeline

- **Initial Response**: Within 24 hours of report submission
- **Assessment**: Within 48 hours for initial vulnerability assessment
- **Updates**: Regular updates every 72 hours until resolution
- **Resolution**: Target resolution within 90 days for confirmed vulnerabilities

### What to Expect

After submitting a report, you can expect:

1. **Acknowledgment**: We'll acknowledge receipt of your vulnerability report within 24 hours
2. **Investigation**: We'll investigate and validate the vulnerability
3. **Communication**: We'll keep you informed of our progress
4. **Resolution**: We'll work to resolve confirmed vulnerabilities promptly
5. **Disclosure**: We'll coordinate with you on public disclosure timing

### Bug Bounty

We currently offer recognition for security researchers who help us keep FANZ MoneyDash secure:

- **Hall of Fame**: Public recognition on our security acknowledgments page
- **Direct Communication**: Direct line to our security team for future reports
- **Coordination**: Involvement in disclosure process and timeline

### Responsible Disclosure

We request that security researchers:

- Allow us reasonable time to investigate and mitigate issues before public disclosure
- Avoid privacy violations, destruction of data, and interruption or degradation of services
- Contact us before engaging in security research that may affect our users, systems, or data
- Only test on systems you own or have explicit permission to test

### Security Measures

FANZ MoneyDash implements multiple layers of security:

- **Application Security**: Input validation, output encoding, authentication, authorization
- **Infrastructure Security**: Network segmentation, access controls, monitoring
- **Data Protection**: Encryption at rest and in transit, secure key management
- **Operational Security**: Regular security updates, vulnerability scanning, incident response

### Vulnerability Categories We're Interested In

High Priority:
- Remote code execution
- SQL injection
- Authentication bypass
- Authorization flaws
- Cross-site scripting (XSS)
- Cross-site request forgery (CSRF)
- Server-side request forgery (SSRF)
- Payment system vulnerabilities
- Data exposure

Medium Priority:
- Information disclosure
- Denial of service
- Business logic flaws
- Session management issues

### Out of Scope

The following are generally not considered security vulnerabilities:
- Issues requiring physical access to a user's device
- Social engineering attacks
- Issues in third-party applications or services
- Vulnerabilities requiring unlikely user interaction
- Issues that require access to already-compromised systems
- Content spoofing without security impact
- Missing security headers without demonstrable impact
- Rate limiting bypass without demonstrable impact

### Legal

We will not pursue legal action against security researchers who:
- Make a good faith effort to avoid privacy violations, destruction of data, and interruption or degradation of our services
- Only interact with accounts they own or with explicit permission of the account holder
- Do not perform attacks that could harm the reliability/integrity of our systems or data
- Contact us with details of any vulnerability found, even if you do not request reward

### Contact

- **Security Email**: security@fanz.network
- **GPG Key**: Available upon request
- **Emergency**: For critical vulnerabilities that pose immediate risk

### Acknowledgments

We thank the following security researchers for their responsible disclosure:

*This section will be updated as we receive and address security reports.*

---

Last updated: December 2024