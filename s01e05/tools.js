const tools = [
  {
    type: "function",
    function: {
      name: "callAPI",
      description: "Wywołuje akcję API kolejkowego. Zwraca dokumentację, status lub wynik operacji. Błędy zawierają dokładne instrukcje co zrobić.",
      parameters: {
        type: "object",
        properties: {
          action: {
            type: "string",
            description: "Nazwa akcji do wykonania (np. 'help', 'reconfigure', 'getstatus', 'setstatus', 'save')",
          },
          args: {
            type: "object",
            description: "Argumenty akcji (np. {route: 'X-01', value: 'RTOPEN'})",
            properties: {
              route: {
                type: "string",
                description: "Nazwa trasy kolejowej (format: [a-z]-[0-9]{1,2}, np. 'X-01')",
              },
              value: {
                type: "string",
                description: "Wartość statusu ('RTOPEN' aby otworzyć, 'RTCLOSE' aby zamknąć)",
              },
            },
            required: [],
          },
        },
        required: ["action"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "wait_and_retry",
      description: "Czeka określoną liczbę sekund przed ponowieniem operacji. Użyj tej funkcji gdy API zwróci błąd rate limit lub tymczasową awarię.",
      parameters: {
        type: "object",
        properties: {
          retry_after: {
            type: "number",
            description: "Liczba sekund do poczekania przed ponowną próbą",
          },
        },
        required: ["retry_after"],
      },
    },
  },
];

export default tools;
