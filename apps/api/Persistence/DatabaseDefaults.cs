using Fylkren.Api.Notifications;
using Fylkren.Api.Platform;
using Microsoft.EntityFrameworkCore;

namespace Fylkren.Api.Persistence;

internal static class DatabaseDefaults
{
    private const string DefaultLogoResource = "Fylkren.Api.Assets.fylkren-logo-web-256.png";
    private static readonly Guid BrandingId = Guid.Parse("00000000-0000-0000-0000-000000000001");
    private static readonly Guid SmtpId = Guid.Parse("00000000-0000-0000-0000-000000000002");
    private static readonly Guid NotificationCursorId = Guid.Parse("00000000-0000-0000-0000-000000000003");
    private static readonly Guid ClassificationId = Guid.Parse("00000000-0000-0000-0000-000000000006");

    public static async Task EnsureCreatedAsync(FylkrenDbContext database, CancellationToken cancellationToken = default)
    {
        if (!await database.BrandingSettings.AnyAsync(cancellationToken))
        {
            var branding = new BrandingSettings(BrandingId);
            branding.SetLogo(ReadDefaultLogo(), "image/png");
            database.BrandingSettings.Add(branding);
        }

        if (!await database.SmtpSettings.AnyAsync(cancellationToken))
        {
            var smtp = new SmtpSettings(SmtpId);
            smtp.Update(false, "smtp.example.invalid", 587, "starttls", null, null,
                "notifications@example.invalid", "Varslinger");
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
            "[{{siteName}}] Nytt oppdrag: {{title}}",
            """
Hei {{recipientName}},

Et nytt oppdrag er mottatt.

Site: {{siteName}}
Arbeidsnivå: {{levelName}}
Oppdrag: {{title}}
Type: {{taskType}}
Prioritet: {{priority}}
Frist: {{deadline}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne oppdraget: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000002"), "work-item-changed",
            "[{{siteName}}] Oppdrag endret: {{title}}",
            """
Hei {{recipientName}},

Et oppdrag er endret av {{actorName}}.

Site: {{siteName}}
Arbeidsnivå: {{levelName}}
Oppdrag: {{title}}
Status: {{status}}
Prioritet: {{priority}}
Frist: {{deadline}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne oppdraget: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000003"), "decision-required",
            "[{{siteName}}] Handling kreves: {{title}}",
            """
Hei {{recipientName}},

En lederbeslutning kreves.

Site: {{siteName}}
Arbeidsnivå: {{levelName}}
Oppdrag: {{title}}
Status: {{status}}
Utløst av: {{actorName}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne beslutningsgrunnlaget: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000004"), "child-work-completed",
            "[{{siteName}}] Leveranse mottatt: {{title}}",
            """
Hei {{recipientName}},

En underenhet har levert på et oppdrag.

Site: {{siteName}}
Mottakende arbeidsnivå: {{levelName}}
Rapporterende enhet: {{reportingUnit}}
Oppdrag: {{title}}
Status: {{status}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne leveransen: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000005"), "planning-completed",
            "[{{siteName}}] Plan klar til godkjenning: {{title}}",
            """
Hei {{recipientName}},

En plan er klar til godkjenning.

Site: {{siteName}}
Arbeidsnivå: {{levelName}}
Planlagt av: {{reportingUnit}}
Oppdrag: {{title}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne planen: {{link}}
"""),
        new(Guid.Parse("10000000-0000-0000-0000-000000000006"), "execution-completed",
            "[{{siteName}}] Utførelse klar til kontroll: {{title}}",
            """
Hei {{recipientName}},

Utførelsen er klar til kontroll.

Site: {{siteName}}
Arbeidsnivå: {{levelName}}
Utført av enhet: {{reportingUnit}}
Oppdrag: {{title}}
Status: {{status}}
Klassifisering: {{classification}}

Handling: {{actionRequired}}

Åpne utførelsen: {{link}}
""")
    ];
}
