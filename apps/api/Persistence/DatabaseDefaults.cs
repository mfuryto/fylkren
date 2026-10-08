using Fylkren.Api.Notifications;
using Fylkren.Api.Platform;
using Fylkren.Api.ArtificialIntelligence;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class DatabaseDefaults
{
    private const string DefaultLogoResource = "Fylkren.Api.Assets.fylkren-logo-web-256.png";
    private static readonly Guid BrandingId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid SmtpId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly Guid NotificationCursorId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    private static readonly Guid ClassificationId = Guid.Parse("00000000-0000-0000-0000-000000000006");
    internal static readonly Guid RegionalSettingsId = Guid.Parse("00000000-0000-0000-0000-000000000007");
    internal static readonly Guid AiSettingsId = Guid.Parse("00000000-0000-0000-0000-000000000008");

    public static async Task EnsureCreatedAsync(FylkrenDbContext database, FylkrenOptions options, CancellationToken cancellationToken = default)
    {
        if (!await database.BrandingSettings.AnyAsync(cancellationToken))
        {
            var branding = new BrandingSettings(BrandingId);
            branding.SetLogo(ReadDefaultLogo(), "image/png");
            database.BrandingSettings.Add(branding);
        }

        if (!await database.RegionalSettings.AnyAsync(cancellationToken))
        {
            database.RegionalSettings.Add(new RegionalSettings(
                RegionalSettingsId,
                options.Localization.DefaultLanguage,
                options.Localization.TimeZone));
        }

        if (!await database.SmtpSettings.AnyAsync(cancellationToken))
        {
            var smtp = new SmtpSettings(SmtpId);
            smtp.Update(false, "smtp.example.invalid", 587, "starttls", null, null,
                "notifications@example.invalid", "Notifications");
            database.SmtpSettings.Add(smtp);
        }

        if (!await database.NotificationProjectionCursors.AnyAsync(cancellationToken))
        {
            database.NotificationProjectionCursors.Add(new NotificationProjectionCursor(
                NotificationCursorId, DateTimeOffset.UtcNow, Guid.Empty));
        }

        if (!await database.ClassificationSettings.AnyAsync(cancellationToken))
        {
            var classificationSettings = new ClassificationSettings(ClassificationId);
            database.ClassificationSettings.Add(classificationSettings);
        }

        if (!await database.AiSettings.AnyAsync(cancellationToken))
            database.AiSettings.Add(new AiSettings(AiSettingsId));

        var existingTemplateKeys = await database.NotificationTemplates.AsNoTracking()
            .Select(value => value.Key)
            .ToHashSetAsync(cancellationToken);
        foreach (var template in NotificationDefaults.All.Where(value => !existingTemplateKeys.Contains(value.Key)))
            database.NotificationTemplates.Add(template);

        await database.SaveChangesAsync(cancellationToken);
    }

    private static byte[] ReadDefaultLogo()
    {
        using var stream = typeof(DatabaseDefaults).Assembly.GetManifestResourceStream(DefaultLogoResource)
            ?? throw new InvalidOperationException($"Embedded default logo '{DefaultLogoResource}' was not found.");
        using var buffer = new MemoryStream();
        stream.CopyTo(buffer);
        return buffer.ToArray();
    }
}

internal static class NotificationDefaults
{
    public static IReadOnlyList<NotificationTemplate> All { get; } =
    [
        new(Guid.Parse("10000000-0000-0000-0000-000000000001"), "new-work-item",
            "[{{siteName}}] New work item: {{title}}",
            """
Hello {{recipientName}},

A new work item has been received.

Site: {{siteName}}
Work level: {{levelName}}
Work item: {{title}}
Type: {{taskType}}
Priority: {{priority}}
Deadline: {{deadline}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the work item: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000002"), "work-item-changed",
            "[{{siteName}}] Work item changed: {{title}}",
            """
Hello {{recipientName}},

A work item was changed by {{actorName}}.

Site: {{siteName}}
Work level: {{levelName}}
Work item: {{title}}
Status: {{status}}
Priority: {{priority}}
Deadline: {{deadline}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the work item: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000003"), "decision-required",
            "[{{siteName}}] Action required: {{title}}",
            """
Hello {{recipientName}},

A management decision is required.

Site: {{siteName}}
Work level: {{levelName}}
Work item: {{title}}
Status: {{status}}
Triggered by: {{actorName}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the decision context: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000004"), "child-work-completed",
            "[{{siteName}}] Delivery received: {{title}}",
            """
Hello {{recipientName}},

A subordinate unit has completed a work item.

Site: {{siteName}}
Receiving work level: {{levelName}}
Reporting unit: {{reportingUnit}}
Work item: {{title}}
Status: {{status}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the delivery: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000005"), "planning-completed",
            "[{{siteName}}] Plan ready for approval: {{title}}",
            """
Hello {{recipientName}},

A plan is ready for approval.

Site: {{siteName}}
Work level: {{levelName}}
Planned by: {{reportingUnit}}
Work item: {{title}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the plan: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000006"), "execution-completed",
            "[{{siteName}}] Execution ready for review: {{title}}",
            """
Hello {{recipientName}},

Execution is ready for review.

Site: {{siteName}}
Work level: {{levelName}}
Executed by unit: {{reportingUnit}}
Work item: {{title}}
Status: {{status}}
Classification: {{classification}}

Action: {{actionRequired}}

Open the execution: {{link}}
""")
    ];
}
