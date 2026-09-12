using Vigilia.Host.Realtime;

// ---------------------------------------------------------------------------
// Vigilia host.
//
// SCAFFOLD STATUS: wiring and security posture are real; sensor collection,
// pairing and the theme library are not yet implemented. Endpoints that would
// imply unbuilt behaviour return 501 rather than pretending to work (§164:
// report untested behaviour).
// ---------------------------------------------------------------------------

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// §147/§149: localhost administration must stay available when LAN serving is
// off, and full editing is localhost-only by default. LAN listening is opt-in
// with explicit interface/port selection, so the default binding is loopback.
builder.WebHost.UseUrls("http://127.0.0.1:5227");

builder.Services
    .AddSignalR(options =>
    {
        // Keep-alive and timeouts tuned for LAN phones that may sleep briefly.
        options.KeepAliveInterval = TimeSpan.FromSeconds(15);
        options.ClientTimeoutInterval = TimeSpan.FromSeconds(45);

        // Telemetry payloads are small and bounded; reject anything unexpected.
        options.MaximumReceiveMessageSize = 32 * 1024;

        // §164: surface real errors during development rather than swallowing them.
        options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    })
    .AddMessagePackProtocol();   // §116: compact batched samples

// CORS is deliberately NOT enabled. The display is served from the same origin
// as the hub; a permissive policy would undermine the §149 host/origin checks.

WebApplication app = builder.Build();

// §149: plain LAN HTTP provides no confidentiality. These headers do not create
// confidentiality either — they only reduce incidental exposure. The documented
// posture remains trusted-network-only, never internet-exposed.
app.Use(async (context, next) =>
{
    context.Response.Headers["X-Content-Type-Options"] = "nosniff";
    context.Response.Headers["Referrer-Policy"] = "no-referrer";
    context.Response.Headers["X-Frame-Options"] = "SAMEORIGIN";
    await next();
});

app.MapHub<MetricsHub>("/hub/metrics");

// Liveness only — deliberately reveals nothing about sensors or configuration to
// an unauthenticated caller.
app.MapGet("/healthz", () => Results.Ok(new { status = "ok" }));

// --- Not yet implemented -----------------------------------------------------
// Declared so the shape is visible, returning 501 so nothing appears to work
// that does not. Each maps to a gate in docs/gates/.

app.MapGet("/api/sensors", () => Results.StatusCode(StatusCodes.Status501NotImplemented))
   .WithDescription("Sensor catalog. Gate 3.");

app.MapGet("/api/themes", () => Results.StatusCode(StatusCodes.Status501NotImplemented))
   .WithDescription("Theme library. Gate 4.");

app.MapPost("/api/pairing/codes", () => Results.StatusCode(StatusCodes.Status501NotImplemented))
   .WithDescription("Short-lived phone pairing codes. Gate 3.");

app.Run();
