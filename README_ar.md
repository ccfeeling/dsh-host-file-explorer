<div align="center">

[English](README.md) · [简体中文](README_zh.md) · [繁體中文](README_zh-TW.md) · [日本語](README_ja.md) · [한국어](README_ko.md) · [Türkçe](README_tr.md) · [Русский](README_ru.md) · [Tiếng Việt](README_vi.md) · [ไทย](README_th.md) · [Deutsch](README_de.md) · [Español](README_es.md) · [Français](README_fr.md) · [Українська](README_uk.md) · [Polski](README_pl.md) · [Português (Brasil)](README_pt-BR.md) · **العربية** · [فارسی](README_fa.md) · [Bahasa Indonesia](README_id.md) · [Italiano](README_it.md)

# مستكشف ملفات Host لـ DSH

### plugin من DeepSeek Harness يضيف مدخلًا في الشريط الجانبي الأيسر لتصفّح نظام ملفات الجهاز الذي يعمل عليه Harness.

[![رخصة MIT](https://img.shields.io/badge/license-MIT-f4c430?style=flat-square)](LICENSE)
[![مدخل في الشريط الجانبي](https://img.shields.io/badge/sidebar-entry-28-4CB1?style=flat-square)](#الميزات)
[![النقل](https://img.shields.io/badge/transport-Host%2FClient_Remote-4CB1?style=flat-square)](#البنية-المعمارية)

</div>

---

تصفّح نظام ملفات الجهاز المضيف من داخل Harness: قوائم للمجلدات مع أنواعها وأحجامها وأوقات تعديلها، ومعاينات للملفات النصية، وإنشاء للمجلدات. تمرّ كل عملية قراءة عبر قناة Remote بين Host وClient، وهي الحدود نفسها التي تستخدمها أدوات نظام الملفات الخاصة بالوكيل. يمكن تنزيل الملفات إلى المتصفح، وتُعرض الصور معاينة داخل اللوحة. يمكن رفع الملفات إلى الدليل المفتوح.

![لوحة ملفات المضيف](assets/screenshot-1.png)

## الميزات

| الميزة | الوصف |
| --- | --- |
| تنزيل الملف | يسلّم الملف إلى المتصفح عبر مسار الملفات المُصادَق عليه الخاص بـ Harness، باسمه الأصلي |
| معاينة الصورة | تعرض صور PNG أو JPEG أو GIF أو WebP أو AVIF أو SVG داخل اللوحة بدل قراءتها كنص |
| قائمة المجلدات | المجلدات أولًا ثم الملفات، مع الحجم ووقت التعديل لكل عنصر؛ وتُعتَّم العناصر المخفية |
| التنقّل بين المسارات | انتقل إلى مسار مطلق، أو إلى المجلد الأعلى، أو استخدم اختصارات HOME وtmp وcwd وجذر نظام الملفات |
| معاينة الملفات | يقرأ أول 256 KiB من ملف نصي ويعرضه؛ أما الملفات الثنائية فتُبلّغ عن نفسها بدلًا من طباعة بيانات تالفة |
| إنشاء المجلدات | ينشئ مجلدًا فرعيًا من مقطع واحد داخل المجلد الحالي |
| واجهة متعددة اللغات | تمر كل النصوص المرئية عبر `ctx.locale`؛ اللوحة تحمل اثنتي عشرة لغة وتتبع لغة الواجهة |
| رفع ملف | يرسل ملفًا من المتصفح إلى الدليل المفتوح في نداء Remote واحد يحمل البايتات |

## التثبيت

### باستخدام مدير plugin (موصى به)

انسخ هذا المستودع، ثم ثبّته من مدير plugin داخل Harness:

```bash
# clone
git clone https://github.com/ccfeeling/dsh-host-file-explorer.git

# install into a DSH profile (replace the profile name and path with yours)
dsh plugin --profile web add /path/to/dsh-host-file-explorer
```

استدعاء الأداة المقابل هو `plugin_manager { action: 'install_bundle', target: '<local path>' }`.

### من متجر الإضافات

الإضافة مدرجة في قائمة [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin)، لذا يستطيع المتجر تثبيتها مباشرة من GitHub:

```bash
dsh plugin --profile web add github:ccfeeling/dsh-host-file-explorer
```

### كاعتمادية داخل profile

```jsonc يمر الملف المرفوع عبر قناة Remote مثل بقية الأوامر: بايتات الملف تحملها الأمر نفسه، لا مسار ملفات المتصفح.
// ~/.dsh/profiles/<profile>/package.json
{
  "dependencies": {
    "@local/dsh-host-file-explorer": "link:/abs/path/to/dsh-host-file-explorer"
  }
}
```

بعد التثبيت تظهر **أيقونة مجلد** في الشريط الجانبي، بعد Plugins وSchedules. انقر عليها لفتح اللوحة.

> **ملاحظة**: إذا كانت لديك في profile اعتمادية تشحن مهارات الوكيل (مثل `dsh-answer-me-with-html`)، فإن pnpm 10.11+ و12.x يرفض التثبيت حتى يتم إعلان مجلد المهارات، ويفشل مع `ERR_PNPM_NO_AGENT_SKILLS_DIR`. عطّل ربط المهارات الخاص بـ pnpm عبر مقطع واحد في ملف `pnpm-workspace.yaml` الخاص بـ profile:
>
> ```yaml
> skills:
>   dirs: []
> ```

## البنية المعمارية

الـ plugin هو حزمة DSH معتادة يتكوّن من نصف Host ونصف Client:

```
index.js   (Host)    ctx.hostFiles  ——  seven verbs over node:fs/promises
client.js  (Client)  sidebar entry + main panel + Remote namespace mount
```

يوفّر **نصف Host** خدمة `ctx.hostFiles` ويضع على أفعالها (verbs) علامة prototype الخاصة بنقل Remote، أي `@deepseek-ai/dsh-typert-protocol/remote-methods`، حتى تتمكّن البوابة (gateway) من اكتشافها في وضع SRC:

| الطريقة | المعاملات | القيمة المُعادة |
| --- | --- | --- |
| `roots()` | — | المواقع المعروفة (HOME، tmp، cwd، جذر نظام الملفات) |
| `list(path, signal)` | `path` | `{ path, parent, home, entries[{ name, path, kind, size, modified, mime, hidden }], truncated }` |
| `stat(path, signal)` | `path` | `{ path, kind, size, modified, mime }` |
| `read(path, signal)` | `path` | `{ path, size, modified, binary, truncated, text }` |
| `mkdir(path, name, signal)` | `path`, `name` | `{ path }` |
| `upload(path, name, data, signal)` | `path`, `name`, `data` | `{ path, size }` |
| `limits()` | — | أكبر ملف يمكن لعملية تنزيل واحدة أن تحمله |

يجب أن يكون `signal` هو المعامل الأخير: فالبوابة تحلّل توقيع الطريقة باستخدام `Function.prototype.toString()` لاستخراج معاملات النقل (wire)، وأي توقيع معطوب يجعل الاستدعاء يفشل.

### كيف تصل الملفات إلى المتصفح

لا تنقل الصفحة بايتات الملفات عبر قناة Remote أبدًا. تسأل Host عن عنوان الملف على مسار الملفات المُصادَق عليه الخاص بـ Harness نفسه — وهو المسار نفسه الذي تستخدمه معاينة المستندات المرفقة لعرض الصور داخل مستند Markdown — ثم ي.fetchه المتصفح عبر الجلسة التي تملكها الصفحة أصلًا. وبذلك يحافظ التنزيل على اسم الملف الأصلي، بينما تحصل المعاينة على نوع المحتوى الحقيقي، فتُرسم صورة PNG كـ PNG.

يحدّ استجابة واحدة سقف بايتات المرفقات في Harness (20 MiB افتراضيًا). تقرأ الصفحة هذا الرقم من Host وترفض التنزيل الأكبر من السقف مع شرح السبب، بدل بدء عملية نقل محسوم|scale فشلها.

يكتب **نصف Client** يدويًا مساهمة Typert في Remote، ويثبّتها عبر `ctx.remote.$mount(...)`، ثم يسجّل فتحتين (slots):

- `sidebar.panellist`: المعرّف `host-files`، والترتيب `30`، مع أيقونة مجلد خاصة به؛
- `main`: المفتاح `host-files`، وهي اللوحة التي يفتحها زر الشريط الجانبي.

### فخّان يستحقان المعرفة

1. **لا يمكن إعلان مساحة الأسماء (namespace) كـ inject خاص بالـ plugin نفسه.** فمساحة `remote.hostFiles` المُثبَّتة هي خدمة قائمة بذاتها، ولا تظهر إلا بعد أن ينفّذ هذا الـ plugin عملية التثبيت (mount) — وأي fiber ينتظرها لن يستيقظ أبدًا، لذا لن يبدأ الـ plugin. اقرأها بدلًا من ذلك عبر `ctx.get('remote.hostFiles')`، وهي نقطة دخول mixin في Cordis تقرأ الخدمة مباشرة من المخزن المشترك:

   ```js
   const namespace = ctx.get('remote.hostFiles');
   ```

   لا يستطيع الـ plugin المُسلَّم كتابة `inject: ['remote.agentPresets']` إلا لأن حزمة أخرى تثبّت مساحات الأسماء تلك، وهذا ما يترك للمستهلك حرية إعلان الاعتمادية.

2. **لا يعتمد نصف Client على أي حزمة عميل من Harness.** يستخدم هذا الـ plugin حزمة `react` و`zod` فقط، ويصمّم نفسه برموز `--dsw-alias-*` الخاصة بسمة الواجهة (theme)، ولا يستورد شيئًا من `@deepseek-ai/dsh-client-ui-primitives` أو من نظائرها.

## الأذونات والحدود

- يقرأ الـ plugin نظام ملفات الجهاز المضيف ب**صلاحيات عملية Harness نفسها**: إذ يستطيع قراءة كل ما يقرأه الحساب الذي يشغّلها. وهذا أمر جوهري في طبيعة مستكشف ملفات المضيف، لذا لا تفعّله إلا على الأجهزة والحسابات التي تثق بها.
- الإضافة **تقرأ فقط، وتُنشئ المجلدات وتستقبل الملفات المرفوعة**. لا تعدّل ملفًا موجودًا ولا تحذفه ولا تعيد تسميته، والرفع لا يستبدل أي ملف قائم.
- تُعيد القائمة الواحدة 2000 عنصر كحد أقصى، وتقرأ المعاينة الواحدة 256 KiB كحد أقصى.
- يحمل التنزيل الواحد على الأكثر سقف بايتات المرفقات في Harness (20 MiB افتراضيًا)؛ وعند التجاوز تشرح اللوحة السبب أولًا.

## التطوير

```bash
node --check index.js
node --check client.js
npm pack --dry-run      # inspect the file list that actually ships
```

أثناء التطوير المحلي يشير ملف profile إلى مجلد العمل عبر `link:`، لذا تظهر التعديلات فورًا بعد تحديث المتصفح (تُصدَّر نسخة وحدة Client بأرقام إصدارات مشتقّة من بصمة المحتوى).

## الرخصة

MIT، راجع [LICENSE](LICENSE).
