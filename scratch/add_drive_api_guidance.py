with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '      } else {\n        alert("Failed to upload to Google Classroom: " + errMsg);\n      }'
replacement = '''      } else if (errMsg.includes("drive.googleapis.com") || errMsg.includes("Google Drive API")) {
        alert("Notice: To enable native Google Drive file previews, please click 'Enable' on the Google Drive API in Google Cloud Console:\\nhttps://console.developers.google.com/apis/api/drive.googleapis.com/overview?project=539216233370");
      } else {
        alert("Failed to upload to Google Classroom: " + errMsg);
      }'''

if target in text:
    text = text.replace(target, replacement, 1)
    with open('frontend/src/organization/OrgDashboard.jsx', 'w', encoding='utf-8') as f:
        f.write(text)
    print("SUCCESS: Added Drive API enable guidance to OrgDashboard.jsx!")
else:
    print("Target not found")

