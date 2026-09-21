'use strict';

const { featureCatalogue } = require('@ibitplay/common');
const { createSecretBox } = require('@ibitplay/auth');

const errors = require('./features.errors');
const { SiteConfigService } = require('../site-config/siteConfig.service');
const { OneSignalProvider } = require('../notifications/providers/onesignal');

const { FEATURES, TEMPLATES, featureByKey, variantOf, defaultVariantOf, isPolicy, resolveVariantKey } = featureCatalogue;

/** The row that remembers which template the site was last set from. */
const TEMPLATE_ROW = '_template';

/**
 * Which variant of each feature this site offers — and the sealed keys an
 * integration needs.
 *
 * ═════════════════════════════════════════════════════════════════════════
 * READS ARE ALWAYS AGAINST THE DATABASE
 *
 * No cache. The point of the owner panel is that an operator enters a key and
 * the next notification uses it, on every site, without a restart. A cache
 * would make "I just turned it on" false for however long it lives, and sends
 * are rare enough that one primary-key read each is nothing.
 * ═════════════════════════════════════════════════════════════════════════
 */
class FeaturesService {
  constructor({ models, logger, config, fetchImpl, clients = null }) {
    this.models = models;
    this.logger = logger;
    this.config = config;
    this.fetchImpl = fetchImpl;
    this.siteConfig = new SiteConfigService({ models, logger, config, clients });
    this.box = null;
  }

  #secretBox() {
    if (!this.box) this.box = createSecretBox({ config: this.config, logger: this.logger });
    return this.box;
  }

  catalogue() {
    return {
      features: FEATURES.map((f) => ({
        key: f.key,
        label: f.label,
        category: f.category,
        kind: f.kind ?? 'feature',
        defaultVariant: defaultVariantOf(f.key),
        flag: f.flag,
        variants: f.variants.map((v) => ({
          key: v.key,
          label: v.label,
          description: v.description,
          configFields: v.configFields ?? [],
          // Labels only — which secrets a variant needs, never their values.
          secretFields: (v.secretFields ?? []).map(({ key, label, required }) => ({ key, label, required })),
        })),
      })),
      templates: Object.entries(TEMPLATES).map(([key, t]) => ({ key, label: t.label, description: t.description, variants: t.variants })),
    };
  }

  async #rows() {
    const rows = await this.models.SiteFeature.findAll({ raw: true });
    return new Map(rows.map((r) => [r.feature, r]));
  }

  /** What an operator sees: every catalogue feature, stored or not, with which secrets are SET. */
  async list() {
    const rows = await this.#rows();
    const template = rows.get(TEMPLATE_ROW)?.variant ?? null;
    return {
      template,
      features: FEATURES.map((f) => {
        const row = rows.get(f.key);
        const policy = isPolicy(f.key);
        // A row written before migration 048 still holds the old name.
        const variant = resolveVariantKey(f.key, row?.variant ?? defaultVariantOf(f.key));
        const spec = variantOf(f.key, variant);
        return {
          feature: f.key,
          label: f.label,
          category: f.category,
          kind: policy ? 'policy' : 'feature',
          // A policy is always in force; its "off" is the `none` variant.
          enabled: policy ? variant !== 'none' : Boolean(row?.enabled),
          isDefault: !row,
          flag: f.flag,
          variant,
          variantLabel: spec?.label ?? variant,
          config: row?.config ?? {},
          secretsSet: Object.fromEntries((spec?.secretFields ?? []).map((s) => [s.key, Boolean(row?.secrets?.[s.key])])),
          updatedBy: row?.updated_by ?? null,
          updatedAt: row?.updated_at ?? null,
        };
      }),
    };
  }

  /**
   * What a browser may read. Only switched-on features, and of their config
   * only what the variant marks public — for push that is the App ID and
   * nothing else. `secrets` never leaves this class except opened in memory.
   */
  async publicList() {
    const rows = await this.#rows();
    return FEATURES.flatMap((f) => {
      const row = rows.get(f.key);
      // A policy is always published — a front end needs to know a cashier is
      // CLOSED as much as which kind it is, so `none` is listed too.
      if (isPolicy(f.key)) return [{ feature: f.key, kind: 'policy', variant: resolveVariantKey(f.key, row?.variant ?? defaultVariantOf(f.key)) }];
      if (!row?.enabled || row.variant === 'none') return [];
      const variant = resolveVariantKey(f.key, row.variant);
      const spec = variantOf(f.key, variant);
      const publicFields = spec?.publicFields ?? [];
      const config = Object.fromEntries(publicFields.filter((k) => row.config?.[k]).map((k) => [k, row.config[k]]));
      return [{ feature: f.key, variant, ...(publicFields.length ? { config } : {}) }];
    });
  }

  #validateFields(feature, variant, { config, secrets }, existing) {
    const spec = variantOf(feature, variant);
    const allowedConfig = new Map((spec.configFields ?? []).map((f) => [f.key, f]));
    const allowedSecrets = new Map((spec.secretFields ?? []).map((f) => [f.key, f]));

    // An empty string is a request to CLEAR. The field being absent is already
    // true of a variant that does not declare it, so that is a no-op, not an
    // error — otherwise "switch to Off and wipe the key" could not be one call,
    // and a failed wipe leaves a sealed key behind.
    for (const key of Object.keys(config ?? {})) {
      if (config[key] === '' && !allowedConfig.has(key)) continue;
      if (!allowedConfig.has(key)) throw errors.UNEXPECTED_FIELD({ feature, variant, field: key });
      const rule = allowedConfig.get(key);
      if (config[key] && rule.pattern && !new RegExp(rule.pattern).test(config[key])) {
        throw errors.INVALID_FIELD({ feature, field: key, expected: rule.pattern });
      }
    }
    for (const key of Object.keys(secrets ?? {})) {
      if (secrets[key] === '' && !allowedSecrets.has(key)) continue;
      if (!allowedSecrets.has(key)) throw errors.UNEXPECTED_FIELD({ feature, variant, field: key });
    }

    return { allowedConfig, allowedSecrets };
  }

  async update({ feature, patch, staff }) {
    const f = featureByKey(feature);
    if (!f) throw errors.UNKNOWN_FEATURE({ feature });

    const current = await this.models.SiteFeature.findByPk(feature, { raw: true });
    const policy = isPolicy(feature);
    // An old name from a client that has not been redeployed is accepted and
    // stored under the current one — see LEGACY_VARIANTS.
    const variant = resolveVariantKey(feature, patch.variant ?? current?.variant ?? defaultVariantOf(feature));
    if (!variantOf(feature, variant)) {
      throw errors.UNKNOWN_VARIANT({ feature, variant, allowed: f.variants.map((v) => v.key) });
    }

    const { allowedConfig, allowedSecrets } = this.#validateFields(feature, variant, patch, current);

    // Switching variant drops fields the new one does not declare.
    const keptConfig = Object.fromEntries(Object.entries(current?.config ?? {}).filter(([k]) => allowedConfig.has(k)));
    const config = { ...keptConfig };
    for (const [k, v] of Object.entries(patch.config ?? {})) {
      if (!allowedConfig.has(k)) continue;
      if (v === '') delete config[k];
      else config[k] = v;
    }

    const keptSecrets = Object.fromEntries(Object.entries(current?.secrets ?? {}).filter(([k]) => allowedSecrets.has(k)));
    const secrets = { ...keptSecrets };
    for (const [k, v] of Object.entries(patch.secrets ?? {})) {
      if (!allowedSecrets.has(k)) continue;
      if (v === '') delete secrets[k];
      else secrets[k] = this.#secretBox().seal(v);
    }

    let enabled = patch.enabled ?? current?.enabled ?? false;
    if (variant === 'none') enabled = false;
    // A policy has no switch: it is in force at whatever variant it holds.
    if (policy) enabled = variant !== 'none';

    // Refuse to switch an integration on without what it needs to run.
    if (enabled) {
      const spec = variantOf(feature, variant);
      const missing = [
        ...(spec.configFields ?? []).filter((r) => r.required && !config[r.key]).map((r) => r.key),
        ...(spec.secretFields ?? []).filter((r) => r.required && !secrets[r.key]).map((r) => r.key),
      ];
      if (missing.length) throw errors.MISSING_FIELD({ feature, variant, missing });
    }

    await this.models.SiteFeature.upsert({
      feature,
      enabled,
      variant,
      config,
      secrets,
      updated_by: staff ? `staff:${staff.id}` : null,
    });

    await this.#syncFlag(f, enabled && variant !== 'none', staff);

    this.logger?.warn(
      {
        staffId: staff?.id,
        feature,
        policy,
        from: current?.variant ?? defaultVariantOf(feature),
        variant,
        enabled,
        configKeys: Object.keys(config),
        // Names only. The values are sealed and never logged.
        secretsChanged: Object.keys(patch.secrets ?? {}),
      },
      'Site feature changed'
    );

    // The flag mirror already pushed the flags; now the variants themselves.
    await this.siteConfig.pushPublic({ features: await this.publicList() });

    return (await this.list()).features.find((x) => x.feature === feature);
  }

  /** Keep the legacy siteconfig column in step, so older readers agree. */
  async #syncFlag(feature, on, staff) {
    if (!feature.flag) return;
    try {
      await this.siteConfig.updateGlobalSettings({ staffId: staff?.id ?? null, [feature.flag]: on });
    } catch (error) {
      // A site with no siteconfig row still gets its feature row; the flag is
      // a mirror, not the source.
      this.logger?.warn({ err: error.message, flag: feature.flag }, 'Could not mirror a feature onto its siteconfig flag');
    }
  }

  async applyTemplate({ template, enable, staff }) {
    const t = TEMPLATES[template];
    if (!t) throw errors.UNKNOWN_TEMPLATE({ template });

    const applied = [];
    for (const [feature, variant] of Object.entries(t.variants)) {
      // Business policies are set on purpose, one at a time. A template that
      // reopened a cashier someone had closed would fail in the worst direction.
      if (isPolicy(feature)) continue;
      const current = await this.models.SiteFeature.findByPk(feature, { raw: true });
      // Never let a template silently change an integration someone keyed in.
      if (featureByKey(feature)?.category === 'integration' && current && current.variant !== 'none') continue;

      const spec = variantOf(feature, variant);
      const needsKeys = [...(spec.configFields ?? []), ...(spec.secretFields ?? [])].some((r) => r.required);
      const on = enable && variant !== 'none' && !needsKeys;
      const keepSameVariant = current?.variant === variant;

      await this.models.SiteFeature.upsert({
        feature,
        variant,
        enabled: on,
        config: keepSameVariant ? current.config : {},
        secrets: keepSameVariant ? current.secrets : {},
        updated_by: staff ? `staff:${staff.id}` : null,
      });
      await this.#syncFlag(featureByKey(feature), on, staff);
      applied.push({ feature, variant, enabled: on });
    }

    await this.models.SiteFeature.upsert({
      feature: TEMPLATE_ROW,
      variant: template,
      enabled: true,
      config: {},
      secrets: {},
      updated_by: staff ? `staff:${staff.id}` : null,
    });

    await this.siteConfig.pushPublic({ features: await this.publicList() });

    this.logger?.warn({ staffId: staff?.id, template, features: applied.length }, 'Site template applied');
    return { template, applied };
  }

  /** The row with its secrets OPENED. Server-side use only. */
  async resolved(feature) {
    const row = await this.models.SiteFeature.findByPk(feature, { raw: true });
    if (!row) return null;
    const box = this.#secretBox();
    const secrets = Object.fromEntries(Object.entries(row.secrets ?? {}).map(([k, v]) => [k, box.open(v)]));
    return { ...row, secrets };
  }

  /**
   * The push transport this site is configured for right now, or null.
   * Called per send — see the note on the class.
   */
  async pushProvider() {
    const row = await this.resolved('push_notifications');
    if (!row?.enabled || row.variant !== 'onesignal') return null;
    if (!row.config?.appId || !row.secrets?.apiKey) return null;
    return new OneSignalProvider({
      appId: row.config.appId,
      apiKey: row.secrets.apiKey,
      segment: row.config.segment,
      logger: this.logger,
      fetchImpl: this.fetchImpl,
    });
  }

  async test({ feature, userId, title, body, staff }) {
    if (feature !== 'push_notifications') throw errors.NOT_TESTABLE({ feature });
    const provider = await this.pushProvider();
    if (!provider) throw errors.NOT_ENABLED({ feature, hint: 'switch on the OneSignal variant with an App ID and REST API key first' });

    const message = { title, body, type: 'general', data: { test: 'true' } };
    try {
      const result = userId
        ? await provider.sendToUsers([userId], message)
        : await provider.sendToSegment(message);
      this.logger?.warn({ staffId: staff?.id, userId: userId ?? null, accepted: result.accepted }, 'Push connection test sent');
      return { ...result, target: userId ? { userId } : { segment: provider.segment } };
    } catch (error) {
      throw errors.PROVIDER_FAILED({ provider: provider.name, reason: error.message });
    }
  }
}

module.exports = { FeaturesService, TEMPLATE_ROW };
