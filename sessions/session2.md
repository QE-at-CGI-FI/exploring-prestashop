# Session 2

Duration: 90 minutes

## What was done

- Taking a look at https://github.com/PrestaShop/PrestaShop/issues to realize there is 1.5k issues
- Analyzing what issues the project cares to fix, and what they keep around for longer on the lists
- Analyzing age of regression bugs, discovering median age is 3.3 years, with only one under 8 months, oldest open for 4.7 years.
- Noting that if the project struggles with testing, it contributes to the user testing where the interest / capacity does not allow for going back to fix things that were regressions
- Add playwright tests to reproduce regression bugs with the default contents locally
- Could confirm one bug, learned there are dependencies on top of the basic package or specific data needed
- Two that should have been confirmable seem to be most likely fixed
- Noted that the github project uses claude, analyzed that it's about 5 months in, using co-authored-by trailer notation, 40 custom skills and an ai-agnostic contect layer, read on #41154
- Analyze closed bugs for 'care to fix' patterns and time to closing, median 5.7 months to close; stale bot 4.5 years 365 / 937 closed in last year.

## Ideas for later:

- list the APIs, and create tests against those.
- leave comments on the actual bug list of the things that were fixed
- analyze what the project has for tests
- test for pricing/tax calculation bugs since they have fixed 47 of those last year
- unmerged PRs: 513 with a lot of fixes in - the project does not benefit from testing
