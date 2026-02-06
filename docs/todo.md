
## Escuchá esta arquitectura:

1.  'Leverage Detection Engine' (NestJS): El protocolo escanea tu roster en tiempo real buscando debilidades estructurales. ¿Se te lesionó tu base titular por 3 meses? El Protocolo lo sabe al instante, acapara los mejores bases disponibles del mercado y te infla el precio un 200% porque huele tu desesperación.
2.  'Future Decay Algorithm': No evalúa tus picks de draft por lo que valen hoy. Proyecta la curva de edad de tus estrellas actuales y calcula que en 2029 tu equipo va a ser un desastre. Por eso, te va a exigir esos picks del 2029 sin protección a cambio de cualquier veterano mediocre. ¡Te hipoteca el futuro sin que te des cuenta!
3.  'The Silence Treatment': Si le haces una oferta baja ("lowball"), no te rechaza al instante. Te deja en 'Visto' por 3 días virtuales mientras simula que escucha ofertas de otros equipos, haciéndote subir tu propia oferta por pánico a perder el deal.


## Te propongo este plan de ataque para hoy:
1.  Domain Layer: Definir la interfaz ContractRepository (para que el dominio no sepa de Supabase).
2.  Infrastructure Layer: Implementar SupabaseContractRepository. Acá es donde vamos a mapear esos campos complejos de salarios (salaryY1, salaryY2, etc.) de la DB a tu entidad limpia.
3.  Domain Service (La Magia): Crear un SalaryCapCalculator. Acá es donde meteríamos la lógica "dura": calcular el cap hit total, validar reglas de CBA, etc. Es el primer paso hacia el "Kimmmy Protocol".
4.  Application Layer: Crear el hook useContracts para conectarlo con el front.