### Task 1: Define and validate the envelope contract

**Files:**
- Modify: src/web/packages/renderer-core/src/theme/document.ts
- Modify: src/web/packages/renderer-core/src/theme/validate.ts
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts
- Modify: schema/theme-document.schema.json
- Modify: src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

**Interfaces:**
- Produces BackgroundMedia, Artboard.backgroundMedia, ThemeMetadata.version, isSemanticVersion(value), and bumpSemanticVersion(version, level).
- Later tasks receive validated image/svg/video asset IDs and a SemVer bump result.

- [ ] **Step 1: Write failing validator and schema-sync tests.**

~~~ts
expect(validateFabricThemeEnvelope({ ...envelope(), metadata: { version: '1.2.3' } })).toMatchObject({ ok: true });
expect(validateFabricThemeEnvelope({ ...envelope(), metadata: { version: 'v1.2.3' } })).toMatchObject({ ok: false });
expect(validateFabricThemeEnvelope({ ...envelope(), artboard: { width: 100, height: 100, backgroundMedia: { assetId: 'clip', fit: 'cover' } }, assets: [{ id: 'clip', kind: 'video', path: 'assets/clip.mp4' }] })).toMatchObject({ ok: true });
expect(schema.$defs.artboard.properties.backgroundMedia).toEqual({ $ref: '#/$defs/backgroundMedia' });
~~~

Cover undeclared IDs, font assets, invalid fit, unknown keys and package bytes that do not exactly match declarations.

- [ ] **Step 2: Confirm failure.**

Run: npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

Expected: FAIL because version/backgroundMedia are not part of the v2 contract.

- [ ] **Step 3: Implement the minimal shared contract.**

Define exact major.minor.patch SemVer without prerelease/build metadata. Validate metadata fields, background-media object keys, fit, declared asset ID and allowed declared kind. Extend the schema identically. Keep paint optional in the type validator so unreleased v2 documents remain readable; edited/new themes must select an existing palette entry.

- [ ] **Step 4: Verify.**

Run: npm run typecheck -w @vigilia/renderer-core; npm test -- --run packages/renderer-core/src/theme/fabric-envelope-validate.test.ts packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts

Expected: PASS.

- [ ] **Step 5: Commit.**

~~~bash
git add src/web/packages/renderer-core/src/theme/document.ts src/web/packages/renderer-core/src/theme/validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.ts src/web/packages/renderer-core/src/theme/fabric-envelope-validate.test.ts schema/theme-document.schema.json src/web/packages/renderer-core/src/theme/fabric-envelope-schema-sync.test.ts
git commit -m "feat(theme): define background media envelope"
~~~

