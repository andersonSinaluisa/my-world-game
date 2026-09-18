# Acceptance Criteria: convenciones

> **Status:** Accepted · **Last Updated:** 2026-09-18
> **Related:** [DEFINITION_OF_READY](DEFINITION_OF_READY.md) · [DEFINITION_OF_DONE](DEFINITION_OF_DONE.md) · [_TEMPLATE_HU.md](_TEMPLATE_HU.md)

Los criterios de aceptación **de cada HU** están en su propio archivo, dentro de [mvp/](mvp/). Este documento define **cómo se escriben** e incluye los **escenarios transversales** que se reutilizan.

## 1. Formato Gherkin

```gherkin
Scenario: <nombre corto en español>
  Given <estado inicial concreto>
  And <más contexto>
  When <una sola acción del jugador o del sistema>
  Then <resultado observable y verificable>
  And <más resultados>
```

**Reglas:**
1. **Una acción por `When`.** Si hay dos, son dos escenarios.
2. **`Then` observable:** lo que el jugador ve u oye, o lo que un test puede comprobar en el World o en el guardado. Evitar frases como "funciona bien".
3. Nombrar entidades con **capacidades**, no con objetos concretos, cuando la regla es genérica. Por ejemplo: "un objeto con `edible`" en vez de "una manzana". Los ejemplos concretos van entre paréntesis.
4. Los números se toman de los documentos (umbrales, capacidades) y **se citan**. No se inventan.
5. **Cada escenario tiene que ser automatizable en el harness headless** o llevar la marca `@manual` con los pasos de verificación en el dispositivo.
6. Etiquetas opcionales: `@manual`, `@persistence`, `@performance`, `@a11y`.

## 2. Escenarios transversales reutilizables

Una HU puede incluirlos por referencia: *"Incluye: AC-PERSIST-01"*.

### AC-PERSIST-01: el cambio sobrevive a salir y volver a la escena
```gherkin
Scenario: persistencia entre escenas
  Given que el jugador modificó el estado de una entidad en la escena A
  When viaja a la escena B y regresa a la escena A
  Then la entidad conserva el estado modificado
```

### AC-PERSIST-02: el cambio sobrevive a cerrar la app
```gherkin
@persistence
Scenario: persistencia tras cerrar la app
  Given que el jugador modificó el estado de una entidad
  And pasó al menos 1 segundo o la app pasó a background
  When la app se cierra por completo y se vuelve a abrir
  Then la entidad conserva el estado modificado
```

### AC-REJECT-01: rechazo amable
```gherkin
Scenario: interacción no válida
  Given que una regla coincide pero una de sus condiciones falla
  When el jugador suelta el objeto
  Then el destino hace una animación "shake" y suena el sonido de rechazo suave
  And el objeto se coloca con la acción `place` bajo el punto de soltado
  And no aparece ningún texto de error
```

### AC-PERF-01: sin tirones
```gherkin
@performance @manual
Scenario: fluidez en el dispositivo de referencia
  Given el dispositivo Android de referencia de gama baja
  When se ejecuta la interacción de la HU 10 veces seguidas
  Then el overlay de rendimiento no muestra caídas del UI thread por debajo del umbral "warning" de PERFORMANCE.md
```

### AC-A11Y-01: comprensible sin leer
```gherkin
@a11y @manual
Scenario: sin lectura
  Given un niño de 5 años que no sabe leer
  When usa la funcionalidad por primera vez sin ayuda
  Then puede completarla guiándose por iconos, animación o sonido
```

## 3. Antipatrones en criterios

- ❌ "Then el juego se siente divertido": no se puede verificar.
- ❌ Escenarios que dependen del orden de ejecución de otros tests.
- ❌ Criterios que fijan una implementación concreta ("usa un useState"), salvo que sea una restricción de arquitectura documentada.
