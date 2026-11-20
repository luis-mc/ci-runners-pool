---
change: minor
task: IMG1
---
Build truth: the job image build streams its steps, each build is a record with outcome, duration, reason and failure class, one build runs per machine at a time on half the cores while jobs run, and the read API and the image.build event are built (R5.68 to R5.72).
