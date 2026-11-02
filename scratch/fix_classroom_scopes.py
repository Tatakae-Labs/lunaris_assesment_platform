with open('frontend/src/organization/OrgDashboard.jsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Update handleConnectGoogleClassroom scopes
old_scopes = 'scope: "https://www.googleapis.com/auth/classroom.courses.readonly https://www.googleapis.com/auth/classroom.rosters.readonly https://www.googleapis.com/auth/classroom.profile.emails https://www.googleapis.com/auth/classroom.coursework.students https://www.googleapis.com/auth/drive.file",'
new_scopes = '''scope: [
        "https://www.googleapis.com/auth/classroom.courses.readonly",
        "https://www.googleapis.com/auth/classroom.rosters.readonly",
        "https://www.googleapis.com/auth/classroom.profile.emails",
        "https://www.googleapis.com/auth/classroom.coursework.students",
        "https://www.googleapis.com/auth/classroom.coursework.me",
        "https://www.googleapis.com/auth/classroom.announcements",
        "https://www.googleapis.com/auth/classroom.courseworkmaterials",
        "https://www.googleapis.com/auth/drive.file"
      ].join(" "),'''

if old_scopes not in text:
    raise ValueError("old_scopes not found in OrgDashboard.jsx!")

text = text.replace(old_scopes, new_scopes, 1)

# 2. Update error handler in handleUploadDirectToClassroom
old_upload_catch = '''    } catch (err) {
      alert("Failed to upload to Google Classroom: " + (err.message || err));
    }'''

new_upload_catch = '''    } catch (err) {
      const errMsg = err.message || String(err);
      if (errMsg.includes("insufficient authentication scopes") || errMsg.includes("403")) {
        alert("Google Classroom requires permission for Announcements & Course Materials.\\n\\nPlease click 'Re-authorize Google' at the top of the Classroom Hub and ensure all permission boxes are checked on Google's consent screen.");
        handleConnectGoogleClassroom();
      } else if (errMsg.includes("invalid authentication credentials") || errMsg.includes("401") || errMsg.includes("re-connect") || errMsg.includes("Expected OAuth 2")) {
        setClassroomConnected(false);
        alert("Your Google Classroom login has expired.\\n\\nPlease click 'Connect Google Classroom' to sign in again.");
        handleConnectGoogleClassroom();
      } else {
        alert("Failed to upload to Google Classroom: " + errMsg);
      }
    }'''

if old_upload_catch not in text:
    raise ValueError("old_upload_catch not found in OrgDashboard.jsx!")

text = text.replace(old_upload_catch, new_upload_catch, 1)

# 3. Update refreshClassroomCourses error handling
old_refresh_catch = '''    } catch (e) {
      console.warn("Classroom courses refresh error:", e);
    }'''

new_refresh_catch = '''    } catch (e) {
      console.warn("Classroom courses refresh error:", e);
      const errMsg = e.message || String(e);
      if (
        errMsg.includes("401") ||
        errMsg.includes("invalid authentication credentials") ||
        errMsg.includes("re-connect") ||
        errMsg.includes("Expected OAuth 2")
      ) {
        setClassroomConnected(false);
        setClassroomCourses([]);
      }
    }'''

if old_refresh_catch not in text:
    raise ValueError("old_refresh_catch not found in OrgDashboard.jsx!")

text = text.replace(old_refresh_catch, new_refresh_catch, 1)

with open('frontend/src/organization/OrgDashboard.jsx', 'w', encoding='utf-8') as f:
    f.write(text)

print("SUCCESS: Updated OrgDashboard.jsx with complete Classroom scopes and reactive re-auth!")

