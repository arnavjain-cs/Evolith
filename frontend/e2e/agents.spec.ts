import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const suffix = () => `${Date.now()}-${Math.floor(Math.random()*10000)}`;

test('blueprint to agent, real tools, run trace, model and agent branches, immutable versions', async ({page}) => {
  const name = `Support demo ${suffix()}`;
  await page.goto('/#agents');
  await expect(page.getByRole('heading', {name:'Your agents, working in concert.'})).toBeVisible();
  await page.getByRole('button', {name:'Blueprints',exact:true}).click();
  const template = page.locator('.agent-blueprint-card').filter({has:page.getByRole('heading',{name:'Support copilot',exact:true})});
  await template.getByRole('button',{name:'Use blueprint'}).click();
  await page.getByLabel('Agent name',{exact:true}).fill(name);
  await page.getByLabel('Workspace knowledge',{exact:true}).fill('Refunds are available for 30 days.\nEscalate exceptions to a human.');
  if (await page.getByRole('button',{name:'Create starter model',exact:true}).count()) await page.getByRole('button',{name:'Create starter model',exact:true}).click();
  await page.getByRole('button',{name:'Create agent',exact:true}).last().click();
  await expect(page.locator('#agent-detail-title')).toHaveText(name);
  await page.getByRole('textbox',{name:'Task',exact:true}).fill('What is the refunds policy?');
  await page.getByRole('button',{name:'Run sandbox task'}).click();
  await expect(page.locator('.agent-run-inspector')).toContainText('[Line 1] Refunds are available for 30 days.');
  await expect(page.locator('.agent-run-inspector')).toContainText('Text analysis');
  await expect(page.locator('.agent-runtime-note')).toContainText('Model output is canned');
  await expect(page.locator('.agent-run-inspector')).toContainText('Words: 5');
  const download = page.waitForEvent('download');
  await page.getByRole('button',{name:'Export run trace'}).click();
  expect((await download).suggestedFilename()).toMatch(/evolith-run-.*json/);
  await page.getByRole('button',{name:'Agents',exact:true}).click();
  await page.locator('.agent-directory-card').filter({hasText:name}).click();
  await page.getByRole('button',{name:'Edit configuration'}).click();
  await page.getByLabel('Agent objective').fill('Draft support responses from current policy.');
  await page.getByRole('button',{name:'Save new version'}).click();
  await expect(page.locator('.agent-detail')).toContainText('AGENT / v2');
  await page.getByRole('button',{name:'Version history'}).click();
  await expect(page.locator('.agent-version-list details')).toHaveCount(2);
  await page.getByRole('button',{name:'Save as blueprint'}).click();
  await expect(page.getByRole('status')).toContainText('Reusable blueprint saved');
  await page.getByRole('button',{name:'Pause agent',exact:true}).click();
  await expect(page.getByRole('button',{name:'Agent paused',exact:true})).toBeDisabled();
  await page.getByRole('button',{name:'Resume agent'}).click();
  await page.getByRole('button',{name:'Branch agent',exact:true}).click();
  await expect(page.locator('#agent-detail-title')).toHaveText(`${name} / branch`);
  await expect(page.locator('.agent-lineage-note').first()).toContainText('v2');
  await page.reload();
  await expect(page.locator('.agent-directory-card').filter({hasText:`${name} / branch`})).toBeVisible();
  await page.getByRole('button',{name:'Model library',exact:true}).click();
  await page.locator('.agent-model-card').first().getByRole('button',{name:'Branch model'}).click();
  const branch = `Model branch ${suffix()}`;
  await page.getByLabel('Model name',{exact:true}).fill(branch);
  await page.getByRole('slider',{name:'Coding model weight'}).fill('90');
  await page.getByRole('button',{name:'Save model branch'}).click();
  const card = page.locator('.agent-model-card').filter({has:page.getByRole('heading',{name:branch,exact:true})});
  await expect(card).toContainText('Rehearsal recipe');
  await expect(card.locator('.agent-lineage-note')).not.toHaveText('Main branch');
});

test('workspace pages and editor are accessible in light, dark, mobile and reduced motion', async ({page,request}) => {
  const model = await (await request.post('/api/workspace/models',{data:{name:`Accessible model ${suffix()}`,weights:{coding:.5,writing:.5}}})).json();
  await request.post('/api/workspace/agents',{data:{name:`Accessible agent ${suffix()}`,model_id:model.id,goal:'Check usable enterprise setup.',instructions:'Explain clearly.',tools:['knowledge_search']}});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#agents');
  await expect(page.locator('.agent-directory-card').first()).toBeVisible();
  for (const theme of ['light','dark']) {
    await page.evaluate(t => {document.documentElement.dataset.theme=t; localStorage.setItem('modelforge-theme',t);},theme);
    for (const [width,height] of [[1440,1000],[390,844]]) {
      await page.setViewportSize({width,height});
      for (const label of ['Agents','Model library','Blueprints','Run monitor']) {
        await page.getByRole('button',{name:label,exact:true}).click();
        if (label === 'Agents') await page.locator('.agent-directory-card').first().click();
        if (label === 'Run monitor' && await page.locator('.agent-run-row').count()) await page.locator('.agent-run-row').first().click();
        const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
        expect(scan.violations,`${theme} ${width} ${label}`).toEqual([]);
        expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth),`${width} ${label} overflow`).toBeTruthy();
      }
      await page.getByRole('button',{name:'Create agent',exact:true}).click();
      await expect(page.getByLabel('Agent name',{exact:true})).toBeFocused();
      const scan=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
      expect(scan.violations,`${theme} ${width} editor`).toEqual([]);
      expect(await page.evaluate(() => document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
      await page.screenshot({path:`test-results/agents-editor-${theme}-${width}.png`,fullPage:true});
      await page.getByRole('button',{name:'Cancel',exact:true}).click();
    }
  }
});

test('homepage introduces reusable setup and links to the workspace', async ({page}) => {
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto('/#agent-platform');
  await expect(page.getByRole('heading',{name:'From custom model to purposeful agent.'})).toBeVisible();
  await expect(page.locator('#agent-platform')).toContainText('SSO, team permissions, external connectors, tenant isolation, and production deployment are planned.');
  const scan=await new AxeBuilder({page}).include('#agent-platform').withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
  expect(scan.violations).toEqual([]);
  await page.getByRole('link',{name:'Open the agent workspace',exact:true}).click();
  await expect(page).toHaveTitle('Evolith — Agent workspace');
  await expect(page.getByRole('heading',{name:'Your agents, working in concert.'})).toBeVisible();
});
