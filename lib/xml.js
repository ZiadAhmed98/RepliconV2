export function parseDurationToHours(dur) {
  if (!dur) return 0;
  const m = dur.match(/^P(?:(\d+(?:\.\d+)?)D)?(?:T(?:(\d+(?:\.\d+)?)H)?(?:(\d+(?:\.\d+)?)M)?(?:(\d+(?:\.\d+)?)S)?)?$/);
  if (!m) return 0;
  const days    = parseFloat(m[1] || 0);
  const hours   = parseFloat(m[2] || 0);
  const minutes = parseFloat(m[3] || 0);
  return days * 8 + hours + minutes / 60;
}

export function parseTasksXml(xmlStr) {
  let counter = 0;
  const allTasks = [];

  const isMSProject = /<Task[\s>]/.test(xmlStr) && /<Name>/.test(xmlStr);

  if (isMSProject) {
    const taskRe = /<Task>([\s\S]*?)<\/Task>/g;
    let taskMatch;
    const rawTasks = [];

    function elText(block, tag) {
      const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
      const m = block.match(re);
      if (!m) return null;
      return m[1].replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;/g,"'").trim();
    }

    while ((taskMatch = taskRe.exec(xmlStr)) !== null) {
      const block = taskMatch[1];
      const uid   = elText(block, 'UID');
      const name  = elText(block, 'Name');
      if (!name || uid === '0') continue;

      const outlineLevelStr = elText(block, 'OutlineLevel');
      const outlineLevel    = outlineLevelStr ? parseInt(outlineLevelStr, 10) : 1;
      const isSummary       = elText(block, 'Summary') === '1';
      const isMilestone     = elText(block, 'Milestone') === '1';
      const durStr          = elText(block, 'ManualDuration') || elText(block, 'Duration');
      const durHours        = parseDurationToHours(durStr);
      const startRaw        = elText(block, 'ManualStart') || elText(block, 'Start');
      const finishRaw       = elText(block, 'ManualFinish') || elText(block, 'Finish');

      rawTasks.push({
        name, outlineLevel, isSummary, isMilestone, durHours,
        startDate: startRaw  ? startRaw.slice(0, 10)  : null,
        endDate:   finishRaw ? finishRaw.slice(0, 10) : null,
      });
    }

    const levelStack = [];
    for (const t of rawTasks) {
      while (levelStack.length > 0 && levelStack[levelStack.length - 1].outlineLevel >= t.outlineLevel) {
        levelStack.pop();
      }
      const parentTempId = levelStack.length > 0 ? levelStack[levelStack.length - 1].tempId : null;
      const tempId = `t${counter++}`;

      allTasks.push({
        _tempId:        tempId,
        _parentTempId:  parentTempId,
        name:           t.name,
        code:           null,
        description:    t.isSummary ? 'Phase / Summary' : t.isMilestone ? 'Milestone' : null,
        startDate:      t.startDate,
        endDate:        t.endDate,
        status:         'open',
        estimatedHours: t.isSummary ? 0 : Math.round(t.durHours * 4) / 4,
        isSummary:      t.isSummary,
      });

      levelStack.push({ tempId, outlineLevel: t.outlineLevel });
    }

    return allTasks;
  }

  function getAttr(attrsStr, name) {
    const re = new RegExp(`(?:^|\\s)${name}="([^"]*?)"`);
    const m = (' ' + attrsStr).match(re);
    return m ? m[1] : null;
  }

  function extractNodes(str) {
    const result = [];
    let i = 0;
    while (i < str.length) {
      const taskStart = str.indexOf('<task', i);
      if (taskStart === -1) break;
      const tagClose = str.indexOf('>', taskStart);
      if (tagClose === -1) break;
      const tagContent = str.slice(taskStart + 5, tagClose);
      const isSelf = tagContent.trimEnd().endsWith('/');
      const attrStr = isSelf ? tagContent.slice(0, tagContent.lastIndexOf('/')).trim() : tagContent.trim();
      if (isSelf) {
        result.push({ attrStr, children: [] });
        i = tagClose + 1;
      } else {
        let depth = 1, j = tagClose + 1;
        while (j < str.length && depth > 0) {
          const nextOpen  = str.indexOf('<task',   j);
          const nextClose = str.indexOf('</task>', j);
          if (nextClose === -1) { j = str.length; break; }
          if (nextOpen !== -1 && nextOpen < nextClose) { depth++; j = nextOpen + 5; }
          else {
            depth--;
            if (depth === 0) {
              result.push({ attrStr, children: extractNodes(str.slice(tagClose + 1, nextClose)) });
              i = nextClose + 7;
              break;
            }
            j = nextClose + 7;
          }
        }
        if (depth > 0) break;
      }
    }
    return result;
  }

  function processNode(node, parentTempId) {
    const tempId = `t${counter++}`;
    const g = (n) => getAttr(node.attrStr, n);
    allTasks.push({
      _tempId:        tempId,
      _parentTempId:  parentTempId || null,
      name:           g('name')          || '(unnamed)',
      code:           g('code')          || null,
      description:    g('description')   || null,
      startDate:      g('startDate')     || null,
      endDate:        g('endDate')       || null,
      status:         g('status')        || 'open',
      estimatedHours: parseFloat(g('estimatedHours')) || 0,
    });
    node.children.forEach(child => processNode(child, tempId));
  }

  const clean = xmlStr.replace(/<\?xml[^?]*\?>/g, '').replace(/<!--[\s\S]*?-->/g, '').trim();
  const inner = clean.replace(/^\s*<tasks[^>]*>/, '').replace(/<\/tasks>\s*$/, '').trim();
  extractNodes(inner).forEach(node => processNode(node, null));
  return allTasks;
}
