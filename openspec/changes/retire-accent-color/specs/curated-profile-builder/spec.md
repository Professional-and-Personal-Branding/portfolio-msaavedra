# curated-profile-builder Specification (delta)

## REMOVED Requirements

### Requirement: El constructor no envía `accentColor`
**Reason**: Describía la primera etapa del retiro (D9 de `polish-builder-and-edge`), cuando la API todavía aceptaba y conservaba el campo. Ahora el campo no existe en el contrato: el tipo generado del cuerpo no lo tiene, así que el constructor no puede enviarlo sin un error de compilación, y la API lo rechaza con 400 (`admin-curated-profile-crud`, *`accentColor` retirado del contrato*).
**Migration**: Nada que hacer en el constructor. El acento se edita como token `colors.accent` en el customizador y se guarda como diferencia en `themeOverrides`, donde la migración dejó el antiguo `accentColor` de cada perfil.
