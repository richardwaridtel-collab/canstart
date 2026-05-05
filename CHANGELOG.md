# Contributing to CanStart

Thank you for your interest in contributing to CanStart! This guide will help you understand how to contribute effectively.

## What is CanStart?

CanStart is a two-sided job marketplace platform connecting Canadian newcomers with employers seeking entry-level talent. Our mission is to reduce employment barriers and accelerate career integration for 450,000+ annual newcomers to Canada.

## For Product Contributions

### Before You Start
- Review [Product Overview](../docs/product/product-overview.md) for market context
- Read [User Research](../docs/product/user-research.md) to understand user needs
- Check [Features](../docs/product/features.md) for current product specs
- Review [Roadmap](../docs/product/product-roadmap.md) for planned work

### Product Contribution Process
1. **Identify the Problem:** Validate that your proposed change addresses a real user need
2. **Research Users:** Conduct at least 3 user conversations if adding significant features
3. **Document Your Thinking:** Create an issue with:
   - Problem statement (user need)
   - Proposed solution
   - Success metrics
   - Impact on roadmap
4. **Get Feedback:** Discuss with product team before building
5. **Implement:** Build with user needs in mind
6. **Test:** Validate with actual users

## For Engineering Contributions

### Code Standards
- Follow existing code patterns
- Add comments for non-obvious logic
- Include unit tests for new features
- Test on multiple browsers

### Pull Request Process
1. Create a feature branch: `feature/user-need-description`
2. Reference the related product documentation
3. Link to product issue in PR description
4. Ensure tests pass
5. Request review from team

### Commit Message Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

Types: feat, fix, docs, style, refactor, perf, test, chore

Example:
```
feat(messaging): add real-time notification for job applications

- Implement WebSocket connection for instant updates
- Add notification badge to inbox
- Tested with 50+ concurrent users

Closes #123
Related to roadmap Phase 2: Trust & Community
```

## For Documentation Contributions

- Keep documentation aligned with product reality
- Update both code comments and product docs
- Use clear, jargon-free language
- Include examples where helpful

## Reporting Issues

### Product Issues
- Reference which user type is affected (job seeker/employer)
- Describe the impact (what gets harder/impossible)
- Suggest potential solutions if you have ideas

### Engineering Issues
- Provide steps to reproduce
- Include browser/OS version
- Explain expected vs actual behavior
- Attach screenshots if visual

## Code of Conduct

- Be respectful and inclusive
- Focus on ideas, not individuals
- Assume good intent
- Help others learn and grow

## Questions?

- Review product docs: [/docs/product/INDEX.md](../docs/product/INDEX.md)
- Open a discussion issue
- Email the product lead

---

**Together, we're building a platform that changes lives. Thank you for contributing!**
