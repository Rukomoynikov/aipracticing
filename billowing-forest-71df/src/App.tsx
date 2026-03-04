import { type FC } from "react";

const App: FC<{ message: string }> = ({ message }) => {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Hello, World!</title>
      </head>
      <body>
        <h1>{message}</h1>
      </body>
    </html>
  );
};

export default App;
