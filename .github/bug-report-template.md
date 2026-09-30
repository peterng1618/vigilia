<!--
The body template an agent files with:

    gh issue create --title "<symptom as a sentence>" \
      --body-file .github/bug-report-template.md \
      --label bug,needs-triage

Delete the guidance lines as you fill each section in, and keep the headings.
The form a human fills in the browser is `.github/ISSUE_TEMPLATE/bug.yml`; it
asks the same questions. This file is the same shape in a form `gh` can post.

**Where the record lives:** an issue is an INPUT, not the backlog.
`docs/product/backlog.jsonl` holds the rows that can still be worked;
`docs/product/backlog-archive.jsonl` holds the closed ones, grepped rather than
read. `npm run backlog:check` enforces both — it derives a `verified` row's
closure from git, so a row citing a commit that never landed is refused. This
issue is pulled into the register when asked, and is closed with a comment
naming the row and the check that ran. Do not treat closing an issue as fixing a
thing — the row is what gets closed.

**A finding not fixed in the same task does not need an issue at all.** Put it
in that commit's message as a `Discovered, not fixed:` trailer — or
`Found by the user, not fixed:` when the user raised it — and run
`npm run backlog:file`, which files a row per bullet. One line in a message
already being written beats a second surface to keep in sync.
-->

**What happens**

<!-- The precise symptom, not your diagnosis of it. -->

**Why**

<!-- Root cause with file:line. If you have not established it, write
"cause not established" and say what you have ruled out. That is a complete
answer here, and better than a guess: a guess recorded as a cause sends the
next person to the wrong subsystem. -->

**Why it is not <adjacent subsystem>**

<!-- Name the subsystem a reader would reasonably suspect, and why it is
correct. Skip only if there genuinely is no candidate. This is the section
that stops a completed investigation being repeated. -->

**Evidence**

<!-- Reproduction steps, test names, commits, measurements. -->

**Next pickup action**

<!-- What the next person should do first. If the choice between owners is
itself the open question, say that and list the candidates. Declining to
choose is a valid answer. -->

**Size — why this is an issue and not fixed on the fly**

<!-- Any one of these makes it an issue:
  - the cause is not established
  - more than one owner could fix it
  - the fix needs a design decision
  - it spans subsystems
  - it blocks the active plan
  - it would need a spec, not a task
All of them being false means it was small: cause named with file:line, the
fix inside one owner, the correct behaviour already specified, an obvious
regression test, and no work lost and no data misrepresented. -->
