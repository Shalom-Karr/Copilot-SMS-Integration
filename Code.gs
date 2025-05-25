// @ts-nocheck
// ========================================================================
//      GroupMe Bot: '+' Command to Copilot, Copilot Image Emailer, & Backup
// ========================================================================
// Version: 5.4.7 (Appends signature to GroupMe messages and Emails)
// ========================================================================

// --- BEGIN CONFIGURATION IN SCRIPT PROPERTIES ---
// 1. ADMIN_EMAIL: (REQUIRED, but now mostly for reference in logs) Your email for bot alerts.
// 2. GROUPME_USER_TOKEN: (REQUIRED) User access token for bot to send messages.
// 3. GROUPME_ACCESS_TOKEN: (REQUIRED) Access token for fetching message history.
// 4. GROUP_ID_FRIENDLY_NAME_MAP: (REQUIRED) JSON string. {"GroupID1":"Friendly Name1", ...}
// 5. RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES: (REQUIRED for backup/manual image emails)
// 6. CC_EMAILS_FOR_DEFAULT_IMAGES: (Optional)
// 7. BCC_EMAILS_FOR_DEFAULT_IMAGES: (Optional)
// 8. EMAIL_SUBJECT_TEMPLATE_IMAGES: (Optional) For default/backup image emails.
// 9. EMAIL_BODY_INTRO_TEMPLATE_IMAGES: (Optional) For default/backup image emails.
// --- END CONFIGURATION IN SCRIPT PROPERTIES ---

// --- SCRIPT CONSTANTS ---
const PLUS_COMMAND_TO_COPILOT_PATTERN = /^\+\s*(.+)/;
const ACTUAL_COPILOT_USER_ID = "128934125";
const COPILOT_NICKNAME_FOR_MENTION = "@Copilot";

const EMAIL_RECIPIENT_FOR_COPILOT_IMAGES = "YOR_PHONE_NUMBER@mypixmessages.com"; // IMPORTANT: User must change this
const EMAIL_SUBJECT_FOR_COPILOT_IMAGES = "Image from Copilot: {{messageTextShort}}";
const EMAIL_BODY_INTRO_FOR_COPILOT_IMAGES = "Image received from Copilot.<br>Accompanying text: \"<i>{{messageText}}</i>\"";

const MAX_PREVIOUS_MESSAGES_TO_FETCH_FOR_EMAIL_CONTEXT = 3;

const PROCESSED_COPILOT_IMAGE_IDS_KEY = 'gmeProcessedCopilotImgIds';
const PROCESSED_BACKUP_IMAGE_IDS_KEY_PREFIX = 'gmeProcessedBackupImgId_';

const MAX_PROCESSED_IDS_TO_STORE = 100;
const MESSAGES_TO_FETCH_FOR_TIMER = 20;

const ADMIN_EMAIL_KEY = 'ADMIN_EMAIL';
const GROUPME_USER_TOKEN_KEY = 'GROUPME_USER_TOKEN';
const GROUPME_ACCESS_TOKEN_KEY = 'GROUPME_ACCESS_TOKEN';
const GROUP_ID_FRIENDLY_NAME_MAP_KEY = 'GROUP_ID_FRIENDLY_NAME_MAP';
const RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES_KEY = 'RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES';
const CC_EMAILS_FOR_DEFAULT_IMAGES_KEY = 'CC_EMAILS_FOR_DEFAULT_IMAGES';
const BCC_EMAILS_FOR_DEFAULT_IMAGES_KEY = 'BCC_EMAILS_FOR_DEFAULT_IMAGES';
const EMAIL_SUBJECT_TEMPLATE_IMAGES_KEY = 'EMAIL_SUBJECT_TEMPLATE_IMAGES';
const EMAIL_BODY_INTRO_TEMPLATE_IMAGES_KEY = 'EMAIL_BODY_INTRO_TEMPLATE_IMAGES';

const SIGNATURE = " Shalom Karr"; // Define the signature
// ========================================================================

function doPost(e) {
  let adminEmailAddress, groupMeUserToken, groupMeAccessToken,
      groupIdFriendlyNameMap = {};
  let recipientEmailForDefaultImages, ccEmailsForDefaultImages, bccEmailsForDefaultImages,
      emailSubjectTemplateBackupImages, emailBodyIntroTemplateBackupImages;
  let groupId = "N/A", groupName = "Unknown Group", messageId = "N/A",
      senderUserId = "N/A", senderName = "N/A", messageText = "", attachmentsFromPost = [];

  try {
    Logger.log("--- Bot v5.4.7: doPost Triggered ---");
    if (!e || !e.postData || !e.postData.contents) {
      Logger.log("ERROR: No postData or no postData.contents received.");
      return ContentService.createTextOutput("");
    }

    const postData = JSON.parse(e.postData.contents);

    groupId = postData.group_id;
    senderUserId = postData.user_id || "UnknownSenderID";
    messageText = (postData.text || "").trim();
    attachmentsFromPost = postData.attachments || [];
    messageId = postData.id;
    senderName = postData.name || "UnknownSenderName";
    const senderType = postData.sender_type;

    if (!groupId || !messageId || senderUserId === "UnknownSenderID") {
      Logger.log("Payload incomplete (missing group_id, message_id, or user_id). Ignoring. Payload: " + JSON.stringify(postData));
      return ContentService.createTextOutput("");
    }

    const scriptProperties = PropertiesService.getScriptProperties();
    adminEmailAddress = scriptProperties.getProperty(ADMIN_EMAIL_KEY); 
    groupMeUserToken = scriptProperties.getProperty(GROUPME_USER_TOKEN_KEY);
    groupMeAccessToken = scriptProperties.getProperty(GROUPME_ACCESS_TOKEN_KEY);
    const groupIdFriendlyNameMapJson = scriptProperties.getProperty(GROUP_ID_FRIENDLY_NAME_MAP_KEY);

    recipientEmailForDefaultImages = scriptProperties.getProperty(RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES_KEY);
    ccEmailsForDefaultImages = scriptProperties.getProperty(CC_EMAILS_FOR_DEFAULT_IMAGES_KEY);
    bccEmailsForDefaultImages = scriptProperties.getProperty(BCC_EMAILS_FOR_DEFAULT_IMAGES_KEY);
    emailSubjectTemplateBackupImages = scriptProperties.getProperty(EMAIL_SUBJECT_TEMPLATE_IMAGES_KEY);
    emailBodyIntroTemplateBackupImages = scriptProperties.getProperty(EMAIL_BODY_INTRO_TEMPLATE_IMAGES_KEY);

    let criticalConfigErrors = [];
    if (!groupMeUserToken) criticalConfigErrors.push(GROUPME_USER_TOKEN_KEY);
    if (!groupMeAccessToken) criticalConfigErrors.push(GROUPME_ACCESS_TOKEN_KEY);
    if (!groupIdFriendlyNameMapJson) criticalConfigErrors.push(GROUP_ID_FRIENDLY_NAME_MAP_KEY);

    if (criticalConfigErrors.length > 0) {
      const errorMsg = `CRITICAL SCRIPT PROPERTY ERROR: Missing one or more required properties: ${criticalConfigErrors.join(', ')}. Bot cannot function correctly. Admin Email: ${adminEmailAddress || 'Not Set'}`;
      Logger.log(errorMsg);
      return ContentService.createTextOutput("");
    }

    try {
      groupIdFriendlyNameMap = JSON.parse(groupIdFriendlyNameMapJson);
      if (!isValidJsonObject(groupIdFriendlyNameMap)) {
        throw new Error(`Value for ${GROUP_ID_FRIENDLY_NAME_MAP_KEY} is not valid JSON.`);
      }
    } catch (parseError) {
      const errorMsg = `CRITICAL JSON PARSE ERROR for ${GROUP_ID_FRIENDLY_NAME_MAP_KEY}: ${parseError.message}. Check the value in Script Properties. Admin Email: ${adminEmailAddress || 'Not Set'}`;
      Logger.log(errorMsg);
      return ContentService.createTextOutput("");
    }
    groupName = groupIdFriendlyNameMap[groupId] || `Unknown Group (${groupId})`;

    let imageUrls = [];
    if (attachmentsFromPost && attachmentsFromPost.length > 0) {
      for (const att of attachmentsFromPost) { if (att.type === "image" && att.url) imageUrls.push(att.url); }
    }
    let actionHandledThisMessage = false;

    // 1. User's "+" command to trigger Copilot
    const plusCommandMatch = messageText.match(PLUS_COMMAND_TO_COPILOT_PATTERN);
    if (plusCommandMatch && plusCommandMatch[1] && senderType !== 'bot') {
      actionHandledThisMessage = true;
      const promptForCopilot = plusCommandMatch[1].trim();
      Logger.log(`User "${senderName}" (${senderUserId}) issued "+" command. Prompt for Copilot: "${promptForCopilot}"`);
      const messageToCopilot = `${COPILOT_NICKNAME_FOR_MENTION} ${promptForCopilot}`;
      sendNewMessageAsUser(messageToCopilot, groupId, groupMeUserToken, ACTUAL_COPILOT_USER_ID, COPILOT_NICKNAME_FOR_MENTION);
      Logger.log(`"+" command processed for message ${messageId}.`);
      return ContentService.createTextOutput("");
    }

    // 2. Message FROM ACTUAL_COPILOT_USER_ID with images
    if (!actionHandledThisMessage && senderUserId === ACTUAL_COPILOT_USER_ID && imageUrls.length > 0) {
      actionHandledThisMessage = true;
      Logger.log(`doPost: Message from ACTUAL_COPILOT_USER_ID (${senderName}) with ${imageUrls.length} image(s) detected. Emailing.`);
      const imageEmailPayload = { id: messageId, group_id: groupId, attachments: attachmentsFromPost, name: senderName, text: messageText, sender_type: senderType, user_id: senderUserId };
      const emailConfigForCopilotImages = {
          recipientEmail: EMAIL_RECIPIENT_FOR_COPILOT_IMAGES,
          ccEmails: null, bccEmails: null,
          subjectTemplate: EMAIL_SUBJECT_FOR_COPILOT_IMAGES,
          bodyIntroTemplate: EMAIL_BODY_INTRO_FOR_COPILOT_IMAGES,
          fetchPreviousMessagesToken: groupMeAccessToken
      };
      processAndSendImageEmail(imageEmailPayload, imageUrls, emailConfigForCopilotImages, groupIdFriendlyNameMap);
      markMessageAsProcessed(messageId, PROCESSED_COPILOT_IMAGE_IDS_KEY);
      Logger.log(`doPost: Images from ACTUAL_COPILOT_USER_ID in message ${messageId} processed and marked.`);
      return ContentService.createTextOutput("");
    }

    // 3. Backup Image Emailer (for other images)
    if (!actionHandledThisMessage && imageUrls.length > 0) {
      Logger.log(`Backup Image Emailer triggered for msg ${messageId} from ${senderName}. Images: ${imageUrls.length}`);
      if (!recipientEmailForDefaultImages) {
        Logger.log(`ERROR: ${RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES_KEY} (for backup) not set.`);
      } else {
        const backupProcessedKey = PROCESSED_BACKUP_IMAGE_IDS_KEY_PREFIX + groupId;
        if (!isMessageProcessed(messageId, backupProcessedKey)) {
            const imageEmailPayload = { id: messageId, group_id: groupId, attachments: attachmentsFromPost, name: senderName, text: messageText, sender_type: senderType, user_id: senderUserId };
            const emailConfigForBackup = {
                recipientEmail: recipientEmailForDefaultImages,
                ccEmails: ccEmailsForDefaultImages,
                bccEmails: bccEmailsForDefaultImages,
                subjectTemplate: emailSubjectTemplateBackupImages,
                bodyIntroTemplate: emailBodyIntroTemplateBackupImages,
                fetchPreviousMessagesToken: groupMeAccessToken
            };
            processAndSendImageEmail(imageEmailPayload, imageUrls, emailConfigForBackup, groupIdFriendlyNameMap);
            markMessageAsProcessed(messageId, backupProcessedKey);
            Logger.log(`doPost: Backup image ${messageId} processed and marked for group ${groupId}.`);
        } else {
            Logger.log(`doPost: Backup image ${messageId} for group ${groupId} already processed. Skipping.`);
        }
      }
      return ContentService.createTextOutput("");
    }

    if (!actionHandledThisMessage) {
        Logger.log(`Msg ${messageId} from ${senderName} ("${messageText.substring(0,30)}...") was not a handled command and had no images for backup.`);
    }
  } catch (error) {
    const adminEmailForError = PropertiesService.getScriptProperties().getProperty(ADMIN_EMAIL_KEY);
    Logger.log(`FATAL Unhandled Error in doPost: ${error.message}\nStack: ${error.stack}\nPayload: ${e && e.postData && e.postData.contents ? e.postData.contents.substring(0,500) : 'N/A'}\nAdmin Email: ${adminEmailForError || 'Not Set'}`);
  }
  finally { return ContentService.createTextOutput(""); }
}


// ========================================================================
// IMAGE EMAILING FUNCTION (Generic - Includes attachment logic & Subject Fallback)
// ========================================================================
function processAndSendImageEmail(messagePayload, imageUrls, emailConfig, groupIdToFriendlyNameMap) {
  if (!emailConfig || !emailConfig.recipientEmail) {
    Logger.log(`ERROR: emailConfig or emailConfig.recipientEmail is missing for msg ${messagePayload ? messagePayload.id : 'Unknown ID'}. Email not sent.`);
    return;
  }
  if (typeof emailConfig.recipientEmail !== 'string' || emailConfig.recipientEmail.indexOf('@') === -1) {
    Logger.log(`ERROR: Invalid recipientEmail format: "${emailConfig.recipientEmail}" for msg ${messagePayload ? messagePayload.id : 'Unknown ID'}. Email not sent.`);
    return;
  }

  const imageMessageId = messagePayload.id;
  const groupId = messagePayload.group_id;
  let previousMessagesHtml = "";

  if (emailConfig.recipientEmail !== EMAIL_RECIPIENT_FOR_COPILOT_IMAGES &&
      emailConfig.fetchPreviousMessagesToken &&
      MAX_PREVIOUS_MESSAGES_TO_FETCH_FOR_EMAIL_CONTEXT > 0) {
     try {
      const messagesUrl = `https://api.groupme.com/v3/groups/${groupId}/messages?token=${emailConfig.fetchPreviousMessagesToken}&before_id=${imageMessageId}&limit=${MAX_PREVIOUS_MESSAGES_TO_FETCH_FOR_EMAIL_CONTEXT}`;
      const resp = UrlFetchApp.fetch(messagesUrl, { muteHttpExceptions: true });
      const responseCode = resp.getResponseCode();
      if (responseCode === 200) {
        const data = JSON.parse(resp.getContentText());
        if (data.response && data.response.messages && data.response.messages.length > 0) {
          previousMessagesHtml = "<b>Prev " + data.response.messages.length + " msgs:</b><br><div style='padding-left:15px;border-left:2px solid #eee;margin-bottom:10px;'>";
          data.response.messages.reverse().forEach(m => {
            previousMessagesHtml += `<small>${escapeHtml(m.name||"Unk")} (${new Date(m.created_at*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}):</small> ${m.text?escapeHtml(m.text):"<i>(No text)</i>"}<br>`;
          });
          previousMessagesHtml += "</div>";
        } else { previousMessagesHtml = `<i>(No prev msgs found before this one)</i><br><br>`; }
      } else {
          previousMessagesHtml = `<i>(Error fetching prev msgs: ${responseCode})</i><br><br>`;
          Logger.log(`Error fetching prev msgs for email. Code: ${responseCode}. URL was: ${messagesUrl.replace(emailConfig.fetchPreviousMessagesToken, "REDACTED")}`);
      }
    } catch (err) {
        previousMessagesHtml = `<i>(Exception fetching prev msgs)</i><br><br>`;
        Logger.log(`Exception during fetch prev msgs for email: ${err.toString()}`);
    }
  }

  const senderName = messagePayload.name || "Unknown";
  const originalMessageText = messagePayload.text || "";
  const friendlyGroupName = groupIdToFriendlyNameMap[groupId] || groupId;

  const templateData = {
    '{{senderName}}': escapeHtml(senderName),
    '{{imageCount}}': imageUrls.length.toString(),
    '{{groupName}}': escapeHtml(groupId),
    '{{friendlyGroupName}}': escapeHtml(friendlyGroupName),
    '{{messageText}}': escapeHtml(originalMessageText),
    '{{senderType}}': escapeHtml(messagePayload.sender_type === "bot" ? "Bot" : "User"),
    '{{messageId}}': escapeHtml(imageMessageId),
    '{{messageTextShort}}': escapeHtml(originalMessageText.substring(0, 50) + (originalMessageText.length > 50 ? "..." : ""))
  };

  let emailSubject;
  if (emailConfig.recipientEmail === EMAIL_RECIPIENT_FOR_COPILOT_IMAGES) {
    emailSubject = replacePlaceholders(emailConfig.subjectTemplate || EMAIL_SUBJECT_FOR_COPILOT_IMAGES, templateData);
    if (!emailSubject || emailSubject.trim() === "Image from Copilot:" || emailSubject.trim().length < 3) {
        emailSubject = `Image from Copilot (Msg ID: ${imageMessageId.slice(-6)})`;
        Logger.log("Used fallback subject for Copilot image email: " + emailSubject);
    }
  } else {
    const defaultSubjectTemplate = `Image(s) from {{senderName}} in {{friendlyGroupName}} (Msg ID: ${imageMessageId.slice(-6)})`;
    emailSubject = replacePlaceholders(emailConfig.subjectTemplate || defaultSubjectTemplate, templateData);
     if (!emailSubject || emailSubject.trim().length < 3) {
        emailSubject = `Image from ${friendlyGroupName} (Msg ID: ${imageMessageId.slice(-6)})`;
        Logger.log("Used fallback subject for default image email: " + emailSubject);
    }
  }

  let emailBodyIntro;
   if (emailConfig.recipientEmail === EMAIL_RECIPIENT_FOR_COPILOT_IMAGES) {
    emailBodyIntro = replacePlaceholders(emailConfig.bodyIntroTemplate || EMAIL_BODY_INTRO_FOR_COPILOT_IMAGES, templateData);
  } else {
    let defaultBodyIntroTemplate = `Image(s) received from <b>{{senderName}}</b> ({{senderType}}) in group <b>{{friendlyGroupName}}</b>.<br>`;
    if (originalMessageText) defaultBodyIntroTemplate += `Accompanying message text: "<i>{{messageText}}</i>"<br><br>`; else defaultBodyIntroTemplate += `<br>`;
    emailBodyIntro = replacePlaceholders(emailConfig.bodyIntroTemplate || defaultBodyIntroTemplate, templateData);
  }

  let mainEmailContent = "";
  if (emailConfig.recipientEmail === EMAIL_RECIPIENT_FOR_COPILOT_IMAGES) {
    mainEmailContent += `<br>--- Image(s) Attached ---<br>`;
  } else {
    mainEmailContent += previousMessagesHtml;
    mainEmailContent += `<b>Image(s) from message (ID: ${escapeHtml(imageMessageId)}):</b><br>`;
  }

  let imageAttachments = [];
  imageUrls.forEach(function(imageUrl, index) {
    const escUrl = escapeHtml(imageUrl);
    if (emailConfig.recipientEmail !== EMAIL_RECIPIENT_FOR_COPILOT_IMAGES || index === 0) { 
        mainEmailContent += `<a href="${escUrl}">${escUrl}</a><br><img src="${escUrl}" alt="Image from GroupMe ${index + 1}" style="max-width:400px; height:auto; margin:5px 0 15px 0;"><br><br>`;
    }
    try {
      if (!imageUrl || typeof imageUrl !== 'string' || !imageUrl.startsWith('http')) {
          Logger.log(`Skipping attachment for invalid imageUrl: ${imageUrl}`);
          return;
      }
      Logger.log(`Fetching image for attachment: ${imageUrl}`);
      const imageResponse = UrlFetchApp.fetch(imageUrl, {muteHttpExceptions: true});
      const responseCode = imageResponse.getResponseCode();

      if (responseCode === 200) {
        const imageBlob = imageResponse.getBlob();
        let fileName = "image_" + (index + 1) + "_" + imageMessageId.replace(/[^a-zA-Z0-9-_]/g, '');
        try {
            let urlParts = imageUrl.split('/');
            let potentialName = decodeURIComponent(urlParts[urlParts.length -1].split('?')[0]);
            if (potentialName.length > 0 && potentialName.includes('.')) {
                fileName = potentialName.replace(/[^a-zA-Z0-9-_\.]/g, '');
                if (fileName.length === 0 || fileName === ".") fileName = "image_" + (index + 1) + ".png";
            } else {
                 fileName = "image_" + (index + 1) + ".png";
            }
        } catch(fnErr){
            Logger.log("Minor error guessing filename: " + fnErr + ". Using generic.");
            fileName = "image_" + (index + 1) + ".png";
        }
        imageBlob.setName(fileName.substring(0, 200));
        imageAttachments.push(imageBlob);
        Logger.log(`Prepared image ${index + 1} for attachment as ${fileName}. Blob size: ${imageBlob.getBytes().length}`);
      } else {
        Logger.log(`Failed to fetch image from ${imageUrl} for attachment. Status: ${responseCode}. Content: ${imageResponse.getContentText().substring(0,200)}`);
      }
    } catch (fetchErr) {
      Logger.log(`Exception fetching image from URL ${imageUrl} for attachment: ${fetchErr.toString()}. It will only be embedded (if possible).`);
    }
  });

  // --- MODIFICATION START: Append signature to email body ---
  const fullEmailBody = emailBodyIntro + mainEmailContent + "<br><br>" + SIGNATURE;
  // --- MODIFICATION END ---

  const mailOptions = {
    to: emailConfig.recipientEmail,
    subject: emailSubject,
    htmlBody: fullEmailBody,
    name: "GroupMe Bot" // Sender name for the email
  };

  if (imageAttachments.length > 0) {
    mailOptions.attachments = imageAttachments;
    Logger.log(`Attempting to add ${imageAttachments.length} image(s) as attachments to the email.`);
  } else {
    Logger.log(`No image blobs successfully fetched for attachment. Email will only have embedded images (if any).`);
  }

  if (emailConfig.recipientEmail !== EMAIL_RECIPIENT_FOR_COPILOT_IMAGES) {
    if (emailConfig.ccEmails && typeof emailConfig.ccEmails === 'string') {
      const cc = emailConfig.ccEmails.split(',').map(e=>e.trim()).filter(e=>e.includes('@')).join(',');
      if (cc) mailOptions.cc = cc;
    }
    if (emailConfig.bccEmails && typeof emailConfig.bccEmails === 'string') {
      const bcc = emailConfig.bccEmails.split(',').map(e=>e.trim()).filter(e=>e.includes('@')).join(',');
      if (bcc) mailOptions.bcc = bcc;
    }
  }

  Logger.log(`Final mailOptions for ${emailConfig.recipientEmail}: To: ${mailOptions.to}, Subject: "${mailOptions.subject}"`);
  if (mailOptions.attachments) { Logger.log(`Number of attachments prepared: ${mailOptions.attachments.length}`); }

  try {
    MailApp.sendEmail(mailOptions);
    Logger.log(`Image email SENT successfully for msg ${imageMessageId} to ${emailConfig.recipientEmail}. Subject: "${emailSubject.substring(0,100)}". Attachments: ${imageAttachments.length}`);
  }
  catch (mailError) {
    const adminEmail = PropertiesService.getScriptProperties().getProperty(ADMIN_EMAIL_KEY);
    Logger.log(`MailApp.sendEmail FAILED for ${imageMessageId} to ${emailConfig.recipientEmail}: ${mailError.toString()}. Stack: ${mailError.stack}. Admin Email: ${adminEmail || 'Not Set'}`);
    Logger.log(`ADMIN NOTIFICATION (Logged): Failed to send image email for message ID ${imageMessageId} to ${emailConfig.recipientEmail}.\nError: ${mailError.toString()}\nSubject was: ${emailSubject}\nIntended Body (first 200 chars):\n${fullEmailBody.substring(0,200)}`);
  }
}

// ========================================================================
// GROUPME MESSAGING HELPERS
// ========================================================================
function sendNewMessageAsUser(textToSend, groupId, userAccessToken, targetMentionUserId, mentionNickname) {
  const baseStatus = { success: false, statusMessage: "", statusCode: null };
  if (!textToSend || !groupId || !userAccessToken) {
    baseStatus.statusMessage = "Error: Missing params for sendNewMessageAsUser."; Logger.log(baseStatus.statusMessage); return baseStatus;
  }

  // --- MODIFICATION START: Append signature to GroupMe message ---
  let messageWithSignature = textToSend + SIGNATURE; // SIGNATURE already has a leading space
  // --- MODIFICATION END ---

  let finalText = messageWithSignature; 
  
  const maxLength = 1000; // GroupMe message length limit
  if (finalText.length > maxLength) {
    const availableLengthForText = maxLength - SIGNATURE.length - 3; // -3 for "..."
    if (availableLengthForText > 0) {
      finalText = textToSend.substring(0, availableLengthForText) + "..." + SIGNATURE;
    } else {
      finalText = SIGNATURE.substring(0, maxLength - 3) + "...";
       Logger.log("Warning: Signature itself is very long, had to truncate signature for GroupMe message.");
    }
  }

  let attachments = [];
  if (targetMentionUserId && mentionNickname) {
    const mentionLength = mentionNickname.length;
    // Check if the *original* textToSend (before signature) starts with the mention
    if (textToSend.toLowerCase().startsWith(mentionNickname.toLowerCase())) { 
         attachments.push({ type: "mentions", user_ids: [String(targetMentionUserId)], loci: [[0, mentionLength]] });
         Logger.log(`Mention attachment prepared for user ${targetMentionUserId} with nickname "${mentionNickname}"`);
    } else {
        Logger.log(`Warning for sendNewMessageAsUser: Mention nickname "${mentionNickname}" not found at start of original text "${textToSend.substring(0,50)}...".`);
    }
  }
  const sourceGuid = Utilities.getUuid();
  const payload = { message: { source_guid: sourceGuid, text: finalText, attachments: attachments } };
  const url = `https://api.groupme.com/v3/groups/${groupId}/messages?token=${userAccessToken}`;
  const options = { method: "post", contentType: "application/json", payload: JSON.stringify(payload), muteHttpExceptions: true };
  try {
    const response = UrlFetchApp.fetch(url, options);
    baseStatus.statusCode = response.getResponseCode();
    const responseText = response.getContentText();
    if (baseStatus.statusCode === 201) { baseStatus.success = true; baseStatus.statusMessage = `Successfully sent new message (status ${baseStatus.statusCode}).`;
    } else { baseStatus.statusMessage = `Failed new message (status ${baseStatus.statusCode}). Resp: ${responseText.substring(0,200)}`; }
    Logger.log(baseStatus.statusMessage + ` Text: "${finalText.substring(0,50)}"`);
  } catch (e) { baseStatus.statusMessage = `Exception sending new message: ${e.message.substring(0, 100)}`; Logger.log(`${baseStatus.statusMessage} Details: ${e.stack || e}`); }
  return baseStatus;
}

// ========================================================================
// TIME-DRIVEN FUNCTIONS (Using ScriptProperties)
// ========================================================================
function checkAndEmailCopilotImages() {
  Logger.log("--- Timer: checkAndEmailCopilotImages() [ScriptProps] starting ---");
  const scriptProperties = PropertiesService.getScriptProperties();
  const groupMeAccessToken = scriptProperties.getProperty(GROUPME_ACCESS_TOKEN_KEY);
  const groupIdFriendlyNameMapJson = scriptProperties.getProperty(GROUP_ID_FRIENDLY_NAME_MAP_KEY);
  const adminEmailAddress = scriptProperties.getProperty(ADMIN_EMAIL_KEY); 

  if (!groupMeAccessToken || !groupIdFriendlyNameMapJson) {
    Logger.log(`Timer ERROR: Missing critical props for checkAndEmailCopilotImages. GroupMeAccessToken Set: ${!!groupMeAccessToken}, GroupIdMap Set: ${!!groupIdFriendlyNameMapJson}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    return;
  }
  let groupIdFriendlyNameMap = {};
  try {
    groupIdFriendlyNameMap = JSON.parse(groupIdFriendlyNameMapJson);
    if (!isValidJsonObject(groupIdFriendlyNameMap)) throw new Error("Invalid JSON");
  }
  catch (e) {
    Logger.log(`Timer ERROR: Parsing GROUP_ID_FRIENDLY_NAME_MAP failed: ${e}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    return;
  }

  const groupIds = Object.keys(groupIdFriendlyNameMap);
  if (groupIds.length === 0) { Logger.log("Timer (Copilot): No groups configured. Exiting."); return; }
  Logger.log(`Timer (Copilot): Checking ${groupIds.length} groups.`);
  let emailsSentThisRun = 0;

  for (const groupId of groupIds) {
    const groupName = groupIdFriendlyNameMap[groupId] || `Group ${groupId}`;
    try {
      const messagesUrl = `https://api.groupme.com/v3/groups/${groupId}/messages?token=${groupMeAccessToken}&limit=${MESSAGES_TO_FETCH_FOR_TIMER}`;
      const response = UrlFetchApp.fetch(messagesUrl, { muteHttpExceptions: true });
      const responseCode = response.getResponseCode(); 
      const responseText = response.getContentText(); 

      if (responseCode === 200) {
        const data = JSON.parse(responseText); 
        if (data.response && data.response.messages && data.response.messages.length > 0) {
          for (const message of data.response.messages.reverse()) {
            if (message.sender_id === ACTUAL_COPILOT_USER_ID && !isMessageProcessed(message.id, PROCESSED_COPILOT_IMAGE_IDS_KEY)) {
              let imageUrlsInMessage = [];
              if (message.attachments) message.attachments.forEach(att => { if (att.type === "image" && att.url) imageUrlsInMessage.push(att.url); });
              if (imageUrlsInMessage.length > 0) {
                Logger.log(`Timer (Copilot): Found unprocessed image message ${message.id} from ACTUAL_COPILOT_USER_ID in ${groupName}. Emailing.`);
                const payload = { id: message.id, group_id: groupId, attachments: message.attachments, name: message.name || "Copilot", text: message.text || "", sender_type: message.sender_type || "user", user_id: message.sender_id };
                const emailCfg = { recipientEmail: EMAIL_RECIPIENT_FOR_COPILOT_IMAGES, ccEmails: null, bccEmails: null, subjectTemplate: EMAIL_SUBJECT_FOR_COPILOT_IMAGES, bodyIntroTemplate: EMAIL_BODY_INTRO_FOR_COPILOT_IMAGES, fetchPreviousMessagesToken: groupMeAccessToken };
                processAndSendImageEmail(payload, imageUrlsInMessage, emailCfg, groupIdFriendlyNameMap);
                emailsSentThisRun++;
                markMessageAsProcessed(message.id, PROCESSED_COPILOT_IMAGE_IDS_KEY);
              }
            }
          }
        }
      } else {
        Logger.log(`Timer (Copilot) ERROR: Fetch messages for ${groupName}. Status: ${responseCode}. Response: ${responseText.substring(0, 500)}. URL: ${messagesUrl.replace(groupMeAccessToken, "REDACTED_TOKEN")}`);
      }
    } catch (err) {
      Logger.log(`Timer (Copilot) EXCEPTION for ${groupName}: ${err.message}\nStack: ${err.stack || '(No stack)'}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    }
    Utilities.sleep(500);
  }
  Logger.log(`--- Timer: checkAndEmailCopilotImages() finished. Emails sent: ${emailsSentThisRun} ---`);
}

function manuallyProcessRecentGroupMeImages() {
  Logger.log("--- Timer/Manual: manuallyProcessRecentGroupMeImages() [ScriptProps] starting ---");
  const scriptProperties = PropertiesService.getScriptProperties();
  const groupMeAccessToken = scriptProperties.getProperty(GROUPME_ACCESS_TOKEN_KEY);
  const groupIdFriendlyNameMapJson = scriptProperties.getProperty(GROUP_ID_FRIENDLY_NAME_MAP_KEY);
  const recipientEmail = scriptProperties.getProperty(RECIPIENT_EMAIL_FOR_DEFAULT_IMAGES_KEY);
  const adminEmailAddress = scriptProperties.getProperty(ADMIN_EMAIL_KEY); 

  if (!groupMeAccessToken || !groupIdFriendlyNameMapJson || !recipientEmail) {
    Logger.log(`Timer/Manual ERROR: Missing critical properties. AccessToken: ${!!groupMeAccessToken}, GroupMap: ${!!groupIdFriendlyNameMapJson}, RecipientEmail: ${!!recipientEmail}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    return;
  }
  let groupIdFriendlyNameMap = {};
  try {
    groupIdFriendlyNameMap = JSON.parse(groupIdFriendlyNameMapJson);
    if (!isValidJsonObject(groupIdFriendlyNameMap)) throw new Error("Invalid JSON");
  }
  catch (e) {
    Logger.log(`Timer/Manual ERROR: Parsing GROUP_ID_FRIENDLY_NAME_MAP failed: ${e}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    return;
  }

  const groupIds = Object.keys(groupIdFriendlyNameMap);
  if (groupIds.length === 0) { Logger.log("Timer/Manual: No groups. Exiting."); return; }
  Logger.log(`Timer/Manual: Checking ${groupIds.length} groups for backup images. Will fetch last ${MESSAGES_TO_FETCH_FOR_TIMER} messages per group.`);
  let emailsSentThisRun = 0;
  const emailConfigForBackup = {
      recipientEmail: recipientEmail,
      ccEmails: scriptProperties.getProperty(CC_EMAILS_FOR_DEFAULT_IMAGES_KEY),
      bccEmails: scriptProperties.getProperty(BCC_EMAILS_FOR_DEFAULT_IMAGES_KEY),
      subjectTemplate: scriptProperties.getProperty(EMAIL_SUBJECT_TEMPLATE_IMAGES_KEY),
      bodyIntroTemplate: scriptProperties.getProperty(EMAIL_BODY_INTRO_TEMPLATE_IMAGES_KEY),
      fetchPreviousMessagesToken: groupMeAccessToken
  };

  for (const groupId of groupIds) {
    const groupName = groupIdFriendlyNameMap[groupId] || `Group ${groupId}`;
    const processedKeyForThisGroup = PROCESSED_BACKUP_IMAGE_IDS_KEY_PREFIX + groupId;
    Logger.log(`Timer/Manual: Processing group "${groupName}" (ID: ${groupId}). Using processed ID key: ${processedKeyForThisGroup}`);
    try {
      const messagesUrl = `https://api.groupme.com/v3/groups/${groupId}/messages?token=${groupMeAccessToken}&limit=${MESSAGES_TO_FETCH_FOR_TIMER}`;
      const response = UrlFetchApp.fetch(messagesUrl, { muteHttpExceptions: true });
      const responseCode = response.getResponseCode(); 
      const responseText = response.getContentText(); 

      if (responseCode === 200) {
        const data = JSON.parse(responseText); 
        if (data.response && data.response.messages && data.response.messages.length > 0) {
          Logger.log(`Timer/Manual: Group "${groupName}" - Found ${data.response.messages.length} messages.`);
          for (const message of data.response.messages.reverse()) {
            let imageUrlsInMessage = [];
            if (message.attachments) {
              message.attachments.forEach(att => { if (att.type === "image" && att.url) imageUrlsInMessage.push(att.url); });
            }
            if (imageUrlsInMessage.length > 0 && message.sender_id !== ACTUAL_COPILOT_USER_ID) {
              if (!isMessageProcessed(message.id, processedKeyForThisGroup)) {
                Logger.log(`Timer/Manual: Group "${groupName}" - Found unprocessed image message ${message.id} from ${message.name}. Emailing to default recipient.`);
                const payload = { id: message.id, group_id: groupId, attachments: message.attachments, name: message.name, text: message.text, sender_type: message.sender_type, user_id: message.sender_id };
                processAndSendImageEmail(payload, imageUrlsInMessage, emailConfigForBackup, groupIdFriendlyNameMap);
                emailsSentThisRun++;
                markMessageAsProcessed(message.id, processedKeyForThisGroup);
              }
            }
          }
        } else {
           Logger.log(`Timer/Manual: Group "${groupName}" - No messages found in the fetched batch.`);
        }
      } else {
        Logger.log(`Timer/Manual ERROR: Fetch messages for ${groupName}. Status: ${responseCode}. Response: ${responseText.substring(0, 500)}. URL: ${messagesUrl.replace(groupMeAccessToken, "REDACTED_TOKEN")}`);
      }
    } catch (err) {
      Logger.log(`Timer/Manual EXCEPTION for ${groupName}: ${err.message}\nStack: ${err.stack || '(No stack)'}. Admin Email: ${adminEmailAddress || 'Not Set'}`);
    }
    Utilities.sleep(1000);
  }
  Logger.log(`--- Timer/Manual: manuallyProcessRecentGroupMeImages() finished. Backup emails sent: ${emailsSentThisRun} ---`);
}

// ========================================================================
// PROCESSED MESSAGE ID HELPERS (Uses ScriptProperties)
// ========================================================================
function isMessageProcessed(messageId, storageKey) {
  const scriptProperties = PropertiesService.getScriptProperties();
  const processedIdsJson = scriptProperties.getProperty(storageKey);
  if (processedIdsJson) {
    try {
      const processedIds = JSON.parse(processedIdsJson);
      return Array.isArray(processedIds) && processedIds.includes(String(messageId));
    } catch (e) {
      Logger.log(`Warning: Could not parse processed IDs for key ${storageKey}: ${e}. Assuming not processed.`);
      return false;
    }
  }
  return false;
}

function markMessageAsProcessed(messageId, storageKey) {
  const scriptProperties = PropertiesService.getScriptProperties();
  let processedIds = [];
  const processedIdsJson = scriptProperties.getProperty(storageKey);
  if (processedIdsJson) {
    try {
      processedIds = JSON.parse(processedIdsJson);
      if(!Array.isArray(processedIds)) {
          Logger.log(`Warning: Data for ${storageKey} was not an array. Resetting.`);
          processedIds = [];
      }
    }
    catch (e) {
      Logger.log(`Warning: Could not parse processed IDs for key ${storageKey} before marking: ${e}. Resetting list.`);
      processedIds = [];
    }
  }
  const stringMessageId = String(messageId);
  if (!processedIds.includes(stringMessageId)) {
    processedIds.push(stringMessageId);
    while (processedIds.length > MAX_PROCESSED_IDS_TO_STORE) {
      processedIds.shift();
    }
    try {
        scriptProperties.setProperty(storageKey, JSON.stringify(processedIds));
    } catch (propError) {
        const adminEmail = scriptProperties.getProperty(ADMIN_EMAIL_KEY);
        Logger.log(`ERROR: Failed to save processed ID ${stringMessageId} for key ${storageKey}: ${propError}. Admin Email: ${adminEmail || 'Not Set'}`);
    }
  }
}

// ========================================================================
// UTILITY FUNCTIONS
// ========================================================================
function isValidJsonObject(obj) { return typeof obj === 'object' && obj !== null && !Array.isArray(obj); }

function replacePlaceholders(template, data) {
  if (!template) return "";
  let result = template;
  for (const key in data) {
    if (data.hasOwnProperty(key)) {
      const placeholderRegex = new RegExp(key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      result = result.replace(placeholderRegex, data[key] === undefined ? "" : data[key]);
    }
  } return result;
}

function escapeHtml(text) {
  if (text == null) return "";
  return String(text)
    .replace(/&/g, "&") // Must be first
    .replace(/</g, "<")
    .replace(/>/g, ">")
    .replace(/"/g, """)
    .replace(/'/g, "'");
}

function viewConfiguredPropertiesInLog() {
  const scriptProps = PropertiesService.getScriptProperties().getProperties();
  if (Object.keys(scriptProps).length === 0) { Logger.log("No script properties are currently set."); return; }
  Logger.log("--- Current Script Properties ---");
  for (const key in scriptProps) { Logger.log(`${key}: ${scriptProps[key]}`); }
  Logger.log("--- Hardcoded Constants of Interest ---");
  Logger.log(`ACTUAL_COPILOT_USER_ID: ${ACTUAL_COPILOT_USER_ID}`);
  Logger.log(`EMAIL_RECIPIENT_FOR_COPILOT_IMAGES: ${EMAIL_RECIPIENT_FOR_COPILOT_IMAGES}`);
  Logger.log(`PROCESSED_COPILOT_IMAGE_IDS_KEY (ScriptProp): ${PROCESSED_COPILOT_IMAGE_IDS_KEY}`);
  Logger.log(`PROCESSED_BACKUP_IMAGE_IDS_KEY_PREFIX (ScriptProp): ${PROCESSED_BACKUP_IMAGE_IDS_KEY_PREFIX}`);
  Logger.log("-------------------------------------");
}

function testSpecificGroupMeMessagesFetch() {
  const url = "https://api.groupme.com/v3/groups/107719625/messages?token=OtLYPU5bLqmgkbjmuqxGBqcfaNuvGVbYrR2ecbxh&limit=20"; 
  Logger.log("Attempting to fetch: " + url);
  try {
    const options = { muteHttpExceptions: true };
    const response = UrlFetchApp.fetch(url, options);
    const responseCode = response.getResponseCode();
    const responseText = response.getContentText();
    Logger.log(`Test Fetch - Status: ${responseCode}`);
    Logger.log(`Test Fetch - Response Text (first 500 chars): ${responseText.substring(0, 500)}`);
    if (responseCode !== 200) Logger.log(`ERROR during test fetch. Full response: ${responseText}`);
    else Logger.log("Test fetch successful!");
  } catch (e) {
    Logger.log(`Exception during test fetch: ${e.toString()}`);
    Logger.log(`Stack: ${e.stack}`);
    if (e.message && e.message.toLowerCase().includes("address unavailable")) Logger.log("CONFIRMED: The exception itself contains 'Address unavailable'.");
  }
}