import chalk from 'chalk';

class ApiResponse<T> {
  success: boolean;

  constructor(
    public statusCode: number,
    public data: T,
    public message: string = 'Success',
  ) {
    this.success = statusCode < 400;

    // Determine the appropriate chalk color based on success or failure
    const log = this.success ? chalk.green : chalk.red;

    // Log the message and formatted data in the chosen color
    console.log(
      log(`\nApiResponse: ${this.message} (Status: ${this.statusCode})\n`),
    );
  }
}

export { ApiResponse };
