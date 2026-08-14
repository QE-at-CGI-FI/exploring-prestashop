# Session 1

Duration: less than 2 hrs

## What was done:

- compose.yaml, with few passes to work around colima limitations and redirects
- playwright tests that document the localhost url, and verify the two entry pages shows up in browser
- human visual on the login to main page, making it obvious there is placeholder contents
- ai eyes on a UI tour, with playwright-cli (less tokens and MCP) to list bugs with definition "anything that might bug a user"


## Ideas for later:

- Bring in Ivan Davidov's agentic AI playwright frame and capture the functionalities more systematically (https://github.com/idavidov13/agentic-playwright)
- Name features, explore some deeper
- Take control over the placeholders and defaults, and explore from there
- Bring in agentic QE fleet and see where it takes me (https://github.com/proffesor-for-testing/agentic-qe)


## Linkedin post of the session: 

Met up with Marko "NarsuMan" Rintamäki today to talk about the great testing course he runs at JAMK. Realizing the mindmap of me exploratory testing on an earlier target they had is already 11 years old (!), I could not resist a bit of testing. 

So for a Friday evening, I spawned up PrestaShop locally on my machine, and fixed the issues I ended up with Colima (my Mac docker tool) not supporting something this was relying on, and dealing with redirects that wouldn't work, all within setting up my docker compose file. This part Narsu called "ops", and I expect testers to be able to do this, particularly with these nicely containerized web things, but also with what used to be installing the whole windows machine back in my starting days. 

It was very obvious that how I explore has changed in 11 years. The first thing I did is add two Playwright tests to remind myself where the main page and admin page are located. An the second thing was touring the UI, listing problems. I would be foolish to not use AI for this work, but also I would be foolish if I stopped here. 

The interesting part starts after this, and I have options: 
- I think I will inject a fuller agentic playwright framework into my exploratory project, to support continuously documenting my insights so that changing the latest of PrestaShop still allows me to be in control
- I would list areas / features I would investigate deeper. Most likely I would start with taking control over the data, because the defaults will hide all the interesting problems. 
- I would revisit the open source projects known issues list, and see if I can score some insight into what they actually care about. 

The meta I set out to explore though, is if we need injected bugs for teaching. My theory of teaching says no. Our production versions are target rich enough without injecting anything. Let's talk about that after I spend a few hours going deeper. 

Getting here, git tells me took less than 2 hours. 
1 hour ago   Initial commit
https://lnkd.in/dn7_538V

This is exploratory testing. 