# Pop a Windows reminder message. Triggered by Task Scheduler.
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show(
    "Check Late_Researcher232 karma + r/Rag thread for OP reply on the Vercel-serverless followup. Then ping Claude.",
    "contrarianAI 11:30am Reminder",
    "OK",
    "Information"
) | Out-Null
