// Hello World - CogniaLauncher Plugin (TypeScript)
// Demonstrates: platform info, i18n, env detection, logging, events
import { cognia } from '@cognia/plugin-sdk';

/**
 * Tool: "hello" — Greets the user with platform and i18n info
 */
function hello(): number {
    const input = Host.inputString();

    // Get platform info
    const platform = cognia.platform.info();
    const uiContext = cognia.ui.getContext();
    cognia.log.info({
        message: `Hello tool invoked on ${platform.os} ${platform.arch}`,
        target: 'plugin.hello',
        fields: {
            os: platform.os,
            arch: platform.arch,
        },
        tags: ['example', 'hello'],
    });

    // Determine user name from input or hostname
    const name = input.trim() || platform.hostname;

    // Translate greeting using plugin's locale data
    const greeting = cognia.i18n.translate('greeting', { name });

    // Get plugin ID
    const pluginId = cognia.event.getPluginId();

    // Emit an event
    cognia.event.emitStr('hello-invoked', name);

    // Return JSON result
    Host.outputString(JSON.stringify({
        greeting,
        pluginId,
        uiContext,
        platform: {
            os: platform.os,
            arch: platform.arch,
            osVersion: platform.osVersion,
        },
    }));
    return 0;
}

/**
 * Tool: "env-check" — Check installed development environments
 */
function env_check(): number {
    const input = Host.inputString();
    cognia.log.info('Environment check tool invoked');

    // Parse which environments to check from input, or use defaults
    let envTypes: string[];
    if (!input.trim()) {
        envTypes = ['node', 'python', 'rust'];
    } else {
        try {
            envTypes = JSON.parse(input);
        } catch {
            envTypes = input.split(',').map((s: string) => s.trim()).filter(Boolean);
        }
    }

    const results = envTypes.map((envType: string) => {
        const detection = cognia.env.detect(envType);

        const message = detection.available
            ? cognia.i18n.translate('envAvailable', {
                env: envType,
                version: detection.currentVersion ?? 'unknown',
            })
            : cognia.i18n.translate('envNotAvailable', { env: envType });

        return {
            envType,
            available: detection.available,
            currentVersion: detection.currentVersion,
            installedVersions: detection.installedVersions,
            message,
        };
    });

    Host.outputString(JSON.stringify({
        environments: results,
        checkedCount: results.length,
    }));
    return 0;
}

/**
 * Tool: "env-dashboard" — Declarative UI dashboard for environments
 * ui_mode = "declarative" in plugin.toml
 */
function env_dashboard(): number {
    const input = Host.inputString();
    cognia.log.info('Environment dashboard invoked');

    // Check if this is an action callback
    const action = cognia.ui.parseAction(input);
    if (action && action.action === 'button_click' && action.buttonId === 'refresh') {
        cognia.log.info('Dashboard refresh requested');
        cognia.ui.toast('Refreshing environment dashboard', { level: 'info' });
    }

    if (action && action.action === 'form_submit') {
        cognia.log.info(`Dashboard form submitted with fields: ${JSON.stringify(action.formDataTypes ?? {})}`);
    }

    const platform = cognia.platform.info();
    const envTypes = ['node', 'python', 'rust', 'go'];

    const tableRows: string[][] = [];
    let detectedCount = 0;

    for (const envType of envTypes) {
        const detection = cognia.env.detect(envType);
        const version = detection.available
            ? (detection.currentVersion ?? 'unknown')
            : 'Not installed';
        if (detection.available) detectedCount++;
        tableRows.push([
            envType,
            version,
            detection.available ? '✅' : '❌',
            String(detection.installedVersions.length),
        ]);
    }

    const activeTargets = Array.isArray(action?.formData?.targets)
        ? (action?.formData?.targets as string[])
        : envTypes;

    const summary = {
        action: action?.action ?? 'initial_render',
        activeTargets,
        sourceType: action?.sourceType ?? 'none',
        version: action?.version ?? 1,
    };

    const blocks = [
        cognia.ui.heading('Environment Dashboard', 1),
        cognia.ui.group('horizontal', [
            cognia.ui.badge(`OS: ${platform.os}`, 'outline'),
            cognia.ui.badge(`Arch: ${platform.arch}`, 'outline'),
            cognia.ui.badge(`${detectedCount}/${envTypes.length} detected`, 'secondary'),
        ], 3),
        cognia.ui.divider(),
        cognia.ui.result(
            detectedCount === envTypes.length
                ? 'All tracked environments are available.'
                : 'Some environments are missing.',
            detectedCount === envTypes.length ? 'success' : 'warning',
            'Environment readiness',
            `Detected ${detectedCount} out of ${envTypes.length}.`,
        ),
        cognia.ui.progress(detectedCount, envTypes.length, 'Detection progress'),
        cognia.ui.table(
            ['Environment', 'Version', 'Status', 'Installed'],
            tableRows,
        ),
        cognia.ui.statCards([
            { id: 'detected', label: 'Detected', value: detectedCount, status: detectedCount > 0 ? 'success' : 'warning' },
            { id: 'total', label: 'Tracked', value: envTypes.length },
            { id: 'targeted', label: 'Selected Targets', value: activeTargets.length },
        ]),
        cognia.ui.descriptionList([
            { term: 'Hostname', description: platform.hostname },
            { term: 'OS Version', description: platform.osVersion },
            { term: 'Last Action', description: summary.action },
        ]),
        cognia.ui.jsonView(summary, 'Action Payload Snapshot'),
        cognia.ui.keyValue([
            ['Hostname', platform.hostname],
            ['OS Version', platform.osVersion],
        ]),
        cognia.ui.form(
            'dashboard-controls',
            [
                cognia.ui.radioGroupField('channel', 'Channel', [
                    { label: 'Stable', value: 'stable' },
                    { label: 'Canary', value: 'canary' },
                ], 'stable'),
                cognia.ui.numberField('retryCount', 'Retry Count', { defaultValue: 1, min: 0, max: 5, step: 1 }),
                cognia.ui.switchField('includePrerelease', 'Include Pre-release', false),
                cognia.ui.multiSelectField('targets', 'Targets', envTypes.map((env) => ({
                    label: env,
                    value: env,
                })), ['node', 'python']),
                cognia.ui.dateTimeField('scheduleAt', 'Schedule At'),
                cognia.ui.passwordField('token', 'Access Token', { placeholder: 'Optional token' }),
            ],
            'Apply Filters',
        ),
        cognia.ui.divider(),
        cognia.ui.actions([
            cognia.ui.button('refresh', 'Refresh', 'default', 'RefreshCw'),
        ]),
    ];

    Host.outputString(cognia.ui.render(blocks));
    return 0;
}

/**
 * Tool: "custom-view" — iframe UI placeholder entry point
 * ui_mode = "iframe" in plugin.toml — the actual UI is in ui/index.html
 * This WASM entry is called by the iframe bridge via cognia.callTool()
 */
function custom_view(): number {
    const input = Host.inputString();
    const platform = cognia.platform.info();

    Host.outputString(JSON.stringify({
        message: `Hello from WASM! Running on ${platform.os}`,
        input,
        timestamp: new Date().toISOString(),
    }));
    return 0;
}

function cognia_on_log(): number {
    const envelope = cognia.log.parseEnvelope<{ os?: string; arch?: string }>(
        Host.inputString(),
    );

    Host.outputString(JSON.stringify({
        observed: true,
        sourceType: envelope?.sourceType ?? null,
        level: envelope?.level ?? null,
        sourcePluginId: envelope?.sourcePluginId ?? null,
        sourceOs: envelope?.fields?.os ?? null,
    }));
    return 0;
}

module.exports = { hello, env_check, env_dashboard, custom_view, cognia_on_log };
