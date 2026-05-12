# Wiring up the framework → website auto-rebuild

The website is rebuilt automatically every time the
[`flixelgdx/flixelgdx`](https://github.com/flixelgdx/flixelgdx) framework
pushes to `master`. This is done with a `repository_dispatch` event sent
from the framework's repository to this one.

To enable it, paste the following workflow file into the **framework
repository** at `.github/workflows/notify-website.yml`:

```yaml
name: Notify website

on:
  push:
    branches: [master]
  workflow_dispatch:

jobs:
  notify:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger flixelgdx-website rebuild
        uses: peter-evans/repository-dispatch@v3
        with:
          token: ${{ secrets.WEBSITE_DISPATCH_TOKEN }}
          repository: flixelgdx/flixelgdx-website
          event-type: framework-updated
          client-payload: |
            {
              "sha": "${{ github.sha }}",
              "ref": "${{ github.ref }}"
            }
```

You will also need a personal access token (classic, scope `repo`, or a
fine-grained token with **Actions: read & write** + **Contents: read**
on `flixelgdx/flixelgdx-website`) stored as the secret
`WEBSITE_DISPATCH_TOKEN` on the framework repo.

That is the entire integration — every push to `master` will fire a
`framework-updated` event here, which kicks the **Deploy website**
workflow and republishes the site with the latest Dokka GFM output.
