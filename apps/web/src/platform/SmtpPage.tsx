import { useEffect, useState } from "react";
import type React from "react";
import { errorMessage } from "../api/errors";
import { Modal } from "../components/Modal";
import { SectionHelp } from "../components/SectionHelp";
import {
  commonNotificationTemplateFields,
  notificationTemplateFieldDescriptionKeys,
  notificationTemplateFields,
  notificationTemplateNameKeys,
  type NotificationDeliveryPage,
  type NotificationTemplate,
  type SmtpConfiguration,
} from "./platformModels";
import {
  loadNotificationTemplates,
  loadNotificationDeliveries,
  loadSmtpConfiguration,
  saveNotificationTemplate,
  saveSmtpConfiguration,
  sendSmtpTest,
} from "./smtpApi";
import { useLanguage, useTranslation } from "../localization/LocalizationProvider";
import { ListSortControl, sortList, type ListSort } from "../components/ListSortControl";

export function SmtpPage() {
  const t=useTranslation();
  const language=useLanguage();
  const [smtp,setSmtp]=useState<SmtpConfiguration|null>(null);
  const [password,setPassword]=useState("");
  const [clearPassword,setClearPassword]=useState(false);
  const [recipient,setRecipient]=useState("");
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState("");
  const [error,setError]=useState("");
  const [templates,setTemplates]=useState<NotificationTemplate[]>([]);
  const [templateEditor,setTemplateEditor]=useState<NotificationTemplate|null>(null);
  const [emailHelpOpen,setEmailHelpOpen]=useState(false);
  const [templateHelpOpen,setTemplateHelpOpen]=useState(false);
  const [deliveries,setDeliveries]=useState<NotificationDeliveryPage|null>(null);
  const [deliveryStatus,setDeliveryStatus]=useState("");
  const [deliveryPage,setDeliveryPage]=useState(1);
  const [deliverySort,setDeliverySort]=useState<ListSort>("newest"),[templateSort,setTemplateSort]=useState<ListSort>("name-asc");
  const load=async()=>setSmtp(await loadSmtpConfiguration());
  const loadTemplates=async()=>setTemplates(await loadNotificationTemplates());
  const loadDeliveries=async(status=deliveryStatus,page=deliveryPage)=>setDeliveries(await loadNotificationDeliveries(status,page));
  useEffect(()=>{Promise.all([load(),loadTemplates(),loadDeliveries("",1)]).catch(problem=>setError(errorMessage(problem,t("emailSetupLoadFailed"))));},[]);
  const save=async(event:React.FormEvent)=>{event.preventDefault();if(!smtp)return;setBusy(true);setMessage("");try{await saveSmtpConfiguration(smtp,password,clearPassword);setPassword("");setClearPassword(false);await load();setMessage(t("smtpSaved"));}catch(problem){setMessage(errorMessage(problem,t("smtpSaveFailed")));}finally{setBusy(false);}};
  const test=async(event:React.FormEvent)=>{event.preventDefault();setBusy(true);setMessage("");try{await sendSmtpTest(recipient);await load();setMessage(t("testMessageSent"));}catch{await load().catch(()=>undefined);setMessage(t("testMessageFailed"));}finally{setBusy(false);}};
  const saveTemplate=async(event:React.FormEvent)=>{event.preventDefault();if(!templateEditor)return;setBusy(true);try{await saveNotificationTemplate(templateEditor);await loadTemplates();setTemplateEditor(null);setMessage(t("templateSaved"));}catch(problem){setMessage(errorMessage(problem,t("templateSaveFailed")));}finally{setBusy(false);}};
  const templateName=(key:string)=>notificationTemplateNameKeys[key]?t(notificationTemplateNameKeys[key]):key;
  return <div className="page platform-admin-page"><header className="page-header"><div><h1>{t("navEmail")}</h1><p className="muted">{t("emailIntro")}</p></div><button className="help-button" type="button" onClick={()=>setEmailHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></header>
    {error&&<p className="status-message error-message">{error}</p>}
    {smtp&&<section className="panel"><div className="section-heading"><div><h2>{t("emailServer")}</h2><p className="muted">{t("passwordProtected")}</p></div></div>
      <form className="stacked-form smtp-settings-form" onSubmit={save}><label className="checkbox-row"><input type="checkbox" checked={smtp.enabled} onChange={event=>setSmtp({...smtp,enabled:event.target.checked})}/><span>{t("enableEmail")}</span></label>
        <div className="smtp-settings-grid"><div className="field"><label>{t("smtpServer")}</label><input required maxLength={255} value={smtp.host} onChange={event=>setSmtp({...smtp,host:event.target.value})}/></div><div className="field"><label>{t("port")}</label><input required type="number" min={1} max={65535} value={smtp.port} onChange={event=>setSmtp({...smtp,port:Number(event.target.value)})}/></div><div className="field"><label>{t("connectionSecurity")}</label><select value={smtp.security} onChange={event=>setSmtp({...smtp,security:event.target.value as "starttls"|"none"})}>{smtp.security==="none"&&<option value="none" disabled>{t("noEncryption")}</option>}<option value="starttls">{t("startTlsRecommended")}</option></select></div><div className="field"><label>{t("username")}</label><input maxLength={255} autoComplete="off" value={smtp.username??""} onChange={event=>setSmtp({...smtp,username:event.target.value})}/></div><div className="field"><label>{t("password")}</label><input type="password" maxLength={1000} autoComplete="new-password" value={password} placeholder={smtp.hasPassword?t("storedKeepEmpty"):t("notSpecified")} onChange={event=>setPassword(event.target.value)}/></div><div className="field"><label>{t("senderAddress")}</label><input required type="email" maxLength={320} value={smtp.fromAddress} onChange={event=>setSmtp({...smtp,fromAddress:event.target.value})}/></div><div className="field"><label>{t("senderName")}</label><input maxLength={200} value={smtp.fromName} onChange={event=>setSmtp({...smtp,fromName:event.target.value})}/></div></div>
        {smtp.security==="none"&&<p className="status-message warning-message">{t("unencryptedSmtpWarning")}</p>}
        {smtp.hasPassword&&<label className="checkbox-row"><input type="checkbox" checked={clearPassword} onChange={event=>setClearPassword(event.target.checked)}/><span>{t("removeStoredSmtpPassword")}</span></label>}
        <div className="inline-actions"><button className="primary-button" disabled={busy}>{t("saveSmtp")}</button></div></form>
      <form className="inline-form" onSubmit={test}><div className="field"><label>{t("testRecipient")}</label><input required type="email" value={recipient} onChange={event=>setRecipient(event.target.value)}/></div><button className="secondary-button" disabled={busy}>{t("sendTestMessage")}</button></form>
      {message&&<p className="status-message">{message}</p>}<p className="muted">{t("lastTest")}: {smtp.lastTestedAt?`${new Date(smtp.lastTestedAt).toLocaleString(language)} · ${smtp.lastTestSucceeded?t("successful"):t("failed")}`:t("notTested")}{smtp.lastTestError?` · ${smtp.lastTestError}`:""}</p>
    </section>}
    <section className="panel notification-delivery-panel"><div className="section-heading"><div><h2>{t("deliveryStatus")}</h2><p className="muted">{t("deliveryStatusIntro")}</p></div><div className="inline-actions"><div className="field compact-field"><label htmlFor="notification-delivery-status">{t("approvalStatus")}</label><select id="notification-delivery-status" value={deliveryStatus} onChange={event=>{const status=event.target.value;setDeliveryStatus(status);setDeliveryPage(1);void loadDeliveries(status,1).catch(()=>setError(t("deliveryStatusLoadFailed")));}}><option value="">{t("all")}</option><option value="pending">{t("pendingOrRetry")}</option><option value="sent">{t("sent")}</option><option value="failed">{t("failed")}</option></select></div><ListSortControl id="email-delivery-sort" value={deliverySort} onChange={setDeliverySort}/><button className="secondary-button" type="button" onClick={()=>void loadDeliveries().catch(()=>setError(t("deliveryStatusLoadFailed")))}>{t("refresh")}</button></div></div>
      {deliveries&&<><div className="notification-delivery-summary"><span><strong>{deliveries.transportEnabled?t("active"):t("inactive")}</strong><small>{t("smtpTransport")}</small></span><span><strong>{deliveries.projectionBacklog}</strong><small>{t("eventsAwaitingQueue")}</small></span><span><strong>{deliveries.pending}</strong><small>{t("awaitingDelivery")}</small></span><span><strong>{deliveries.failed}</strong><small>{t("permanentlyFailed")}</small></span></div><p className="muted">{t("lastProcessedEvent",{time:new Date(deliveries.lastProjectedAt).toLocaleString(language)})}</p><div className="admin-list">{deliveries.items.length===0?<p className="empty-state">{t("noMatchingDeliveries")}</p>:sortList(deliveries.items,deliverySort,{name:value=>value.workItemTitle??value.recipientName,createdAt:value=>value.createdAt}).map(delivery=><div className="admin-list-row notification-delivery-row" key={delivery.id}><span><strong>{delivery.workItemTitle??t("taskUnavailable")}</strong><small>{delivery.siteName??t("unknownSite")} · {delivery.recipientName} &lt;{delivery.recipientEmail}&gt;</small><small>{t("createdAt",{time:new Date(delivery.createdAt).toLocaleString(language)})} · {delivery.status==="sent"&&delivery.sentAt?t("sentAt",{time:new Date(delivery.sentAt).toLocaleString(language)}):delivery.status==="pending"?t("nextAttemptAt",{time:new Date(delivery.nextAttemptAt).toLocaleString(language)}):t("noMoreAutomaticAttempts")}</small>{delivery.lastError&&<small className="delivery-error">{t("reason",{reason:delivery.lastError})}</small>}</span><strong className={`delivery-status ${delivery.status}`}>{delivery.status==="sent"?t("sent"):delivery.status==="pending"?t("pendingOrRetry"):t("failed")}{delivery.attempts>0?` · ${t("attempts",{count:delivery.attempts})}`:""}</strong></div>)}</div>{deliveries.totalPages>1&&<div className="pagination"><button className="secondary-button" type="button" disabled={deliveryPage<=1} onClick={()=>{const page=deliveryPage-1;setDeliveryPage(page);void loadDeliveries(deliveryStatus,page);}}>{t("previous")}</button><span>{t("pageOf",{page:deliveryPage,totalPages:deliveries.totalPages})}</span><button className="secondary-button" type="button" disabled={deliveryPage>=deliveries.totalPages} onClick={()=>{const page=deliveryPage+1;setDeliveryPage(page);void loadDeliveries(deliveryStatus,page);}}>{t("next")}</button></div>}</>}
    </section>
    <section className="panel notification-template-panel"><div className="section-heading"><div><h2>{t("notificationTemplates")}</h2><p className="muted">{t("notificationTemplatesIntro")}</p></div><div className="inline-actions"><ListSortControl id="email-template-sort" value={templateSort} onChange={setTemplateSort} options={["name-asc","name-desc"]}/><button className="help-button" type="button" onClick={()=>setTemplateHelpOpen(true)}><i aria-hidden="true">?</i><span>{t("help")}</span></button></div></div><div className="admin-list">{sortList(templates,templateSort,{name:template=>templateName(template.key)}).map(template=><div className="admin-list-row" key={template.key}><span><strong>{templateName(template.key)}</strong><small>{template.subject}</small></span><button className="secondary-button" type="button" onClick={()=>setTemplateEditor({...template})}>{t("edit")}</button></div>)}</div></section>
    {templateEditor&&<Modal title={t("editTemplate",{name:templateName(templateEditor.key)})} onClose={()=>setTemplateEditor(null)}><form className="stacked-form" onSubmit={saveTemplate}><div className="field"><label>{t("subject")}</label><input required maxLength={200} value={templateEditor.subject} onChange={event=>setTemplateEditor({...templateEditor,subject:event.target.value})}/></div><div className="field"><label>{t("message")}</label><textarea required rows={14} maxLength={10000} value={templateEditor.body} onChange={event=>setTemplateEditor({...templateEditor,body:event.target.value})}/></div><div className="modal-note"><strong>{t("availableTemplateFields")}</strong><div className="template-field-list">{(notificationTemplateFields[templateEditor.key]??commonNotificationTemplateFields).map(field=><p key={field}><code>{`{{${field}}}`}</code> – {notificationTemplateFieldDescriptionKeys[field]?t(notificationTemplateFieldDescriptionKeys[field]):field}</p>)}</div></div><p className="muted modal-note">{t("templateSiteNameNote")}</p><div className="modal-actions"><button className="secondary-button" type="button" onClick={()=>setTemplateEditor(null)}>{t("cancel")}</button><button className="primary-button" disabled={busy}>{t("saveTemplate")}</button></div></form></Modal>}
    {emailHelpOpen&&<SectionHelp title={t("emailHelpTitle")} intro={t("emailHelpIntro")} steps={[{title:t("smtpConfigureTitle"),text:t("smtpConfigureText")},{title:t("smtpSenderTitle"),text:t("smtpSenderText")},{title:t("smtpTestTitle"),text:t("smtpTestText")},{title:t("smtpTemplatesTitle"),text:t("smtpTemplatesText")}]} note={t("smtpPasswordNote")} onClose={()=>setEmailHelpOpen(false)}/>}
    {templateHelpOpen&&<SectionHelp title={t("templateHelpTitle")} intro={t("templateHelpIntro")} steps={[{title:t("templateTypeTitle"),text:t("templateTypeText")},{title:t("templateStructureTitle"),text:t("templateStructureText")},{title:t("templateFieldsTitle"),text:t("templateFieldsText")},{title:t("templateLinkTitle"),text:t("templateLinkText")}]} note={t("templateContentNote")} onClose={()=>setTemplateHelpOpen(false)}/>}
  </div>;
}
