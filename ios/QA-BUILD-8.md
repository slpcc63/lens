# Lens Position badge guide — internal QA

request_id: lens-ios-stage-two-wizard
revision: 4
supersedes: revision 3 for build 8 only; preserve earlier findings
state: pending TestFlight availability
candidate: 0.1.0 (8), internal TestFlight
report_back_to: Sniffies / Lens distribution and iPhone app chat
report_back_url: codex://threads/01a1c972-14de-7132-ad54-1b614a52380e
report_back_instructions: Report the exact build, device, whether the Position guide made the map badges recognizable, and the first step that failed. Omit private profile and account information.

The goal is to make Position understandable when the map shows icons and the site gives Lens only text labels. Start in TestFlight on an iPhone with the candidate build available through Owner Testing.

1. Open Lens 0.1.0 (8), open your saved site and navigate to the map. Open **Set up filtering** and choose **Scan current listing**. Verify the map count is reported and setup stays on Scan.
2. Tap **Done**, open one profile, reopen filtering and choose **Scan current listing**. Verify one sample is added. Repeat with a few profiles, then choose **Continue with … collected**. If no fields are detected, report the scan result and stop.
3. In **Confirm or correct fields**, find **Position**. The guide should show **🍆 Eggplant → Top** and **🍑 Peach → Bottom** and call them examples. Each observed option should show the site's reported value separately from the editable **Lens filter value**. An observed emoji should remain visible as part of its source option, while a text-only source should remain text.
4. If a mapping looks wrong, change its **Lens filter value**. If you cannot tell what a badge means, leave **Use this detected field** off. Verify that turning off Position still lets you continue if you have confirmed another field.
5. With a verified field, choose **Set filter preferences**, select allowed values, and review calibration. Verify match or block reasons reflect the options chosen. Use correction to revisit a misclassification, then try the dimmed preview and **Show all** to restore it.

Stop and report the first mismatch if the scan jumps to preferences or a badge meaning is unclear. Keep profile screenshots and credentials out of the report.
