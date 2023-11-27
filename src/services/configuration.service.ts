import process from 'process';
import dotenv from 'dotenv';
import fs from 'fs';

import { Environment, EnvironmentSchema, InputConfiguration, InputSchema } from '../schemas';

/**
 * This is an isolated type used only by the Configuration Service and it's
 * used to filter out properties from the configuration that shouldn't be exposed to the application.
 * There might be some properties in our configuration that only our Configuration Service should use
 * and in such case it can use InputConfiguration directly while other classes would get typed
 * property from our configuration using `.get()` method of the service which will automatically make
 * proper type for the retrieved property and allow usage of autocompletion while developing.
 */
type AccessibleConfigProps = Omit<InputConfiguration, 'store'>;

/**
 * The `ConfigurationService` class serves as the central repository for all configuration-related concerns.
 * It encapsulates the logic for reading, validating, and managing both environment variables and input configurations
 * required for the DevBot application. The class leverages Zod schemas to ensure validation and typing integrity.
 *
 * Configuration properties can be selectively and securely accessed using the `.get()` method, based on the
 * `AccessibleConfigProps` type definition.
 *
 * This class abstracts the underlying complexities related to configuration management and provides a unified
 * interface to other parts of the application, promoting maintainability and adherence to best practices.
 *
 * @class
 * @since 1.0.0
 *
 * @example
 * const configService = new ConfigurationService();
 * const repositories = configService.get('repositories'); // retrieves a specific configuration property
 */
export class ConfigurationService {
  private readonly environment: Environment;
  private readonly configuration: InputConfiguration;

  /**
   * Retrieves a specific property from the configuration based on the provided key.
   * Only keys that are part of the `AccessibleConfigProps` type are valid, ensuring
   * controlled access to the configuration properties.
   *
   * @param {K} key - The property key to retrieve. Must be one of the keys defined in `AccessibleConfigProps`.
   * @returns {AccessibleConfigProps[K] | undefined} The value of the key, or `undefined` if the key does not exist.
   * @template K Type parameter representing the keys of the accessible configuration properties.
   * @since 1.0.0
   *
   * @example
   * const configService = new ConfigurationService();
   * const repositories = configService.get('repositories'); // returns the 'repositories' value as string[]
   */
  public get<K extends keyof AccessibleConfigProps>(key: K): AccessibleConfigProps[K] | undefined {
    return this.configuration[key] as AccessibleConfigProps[K];
  }

  public get storePath(): string {
    return this.configuration.store.directory;
  }

  public get openAIKey(): string {
    return this.environment.OPENAI_API_KEY;
  }

  public get openAIApiOrganizationId(): string {
    return this.environment.OPENAI_API_ORGANIZATION_ID;
  }

  public get azureOpenAiKey(): string {
    return this.environment.AZURE_OPEN_AI_KEY;
  }

  public get azureOpenAiInstanceName(): string {
    return this.environment.AZURE_OPEN_AI_INSTANCE_NAME;
  }

  public get azureOpenAiDeploymentName(): string {
    return this.environment.AZURE_OPEN_AI_DEPLOYMENT_NAME;
  }

  public get azureOpenAiVersion(): string {
    return this.environment.AZURE_OPEN_AI_VERSION;
  }

  public get anthropicApiKey(): string {
    return this.environment.ANTHROPIC_API_KEY;
  }

  constructor() {
    dotenv.config();
    this.environment = this.getEnvironment();
    this.configuration = this.getConfiguration();
  }

  public setEditor(editor = 'code'): void {
    process.env.VISUAL = `${editor} --wait`;
    process.env.EDITOR = `${editor} --wait`;
  }

  /**
   * Retrieves and validates the environment variables required for the application.
   * Only the keys that are defined in the `EnvironmentSchema` are extracted, and the
   * method validates the extracted variables against the Zod schema to ensure they adhere
   * to the expected types and constraints.
   *
   * @returns {Environment} An object containing the filtered and validated environment variables.
   * @throws {Error} If the validation against the Zod schema fails.
   * @private
   * @since 1.0.0
   *
   * @example
   * const environment = this.getEnvironment(); // returns the validated environment variables
   */
  private getEnvironment(): Environment {
    try {
      // Extracting only the keys that are present in our schema
      const filteredEnvironment: Record<string, string | number> = Object.fromEntries(
        Object.entries(process.env).filter(([key]): boolean => key in EnvironmentSchema.shape)
      );

      // Validating against the Zod schema
      return EnvironmentSchema.parse(filteredEnvironment);
    } catch (error) {
      console.error(error);
      throw new Error('Provided environment variables are invalid.');
    }
  }

  /**
   * Reads and validates the configuration file specified in the `DEVBOT_CONFIG` environment variable.
   * The method reads the configuration file as a UTF-8 encoded string, parses the JSON content, and
   * validates it against the `InputSchema` using Zod to ensure the structure and types match the expected format.
   *
   * @returns {InputConfiguration} An object containing the validated configuration data.
   * @throws {Error} If the file cannot be read or the validation against the Zod schema fails.
   * @private
   * @since 1.0.0
   *
   * @example
   * const configuration = this.getConfiguration(); // returns the validated configuration data
   */
  private getConfiguration(): InputConfiguration {
    try {
      const rawData = fs.readFileSync(this.environment.DEVBOT_CONFIG, 'utf8');
      const parsedData = JSON.parse(rawData);

      // Validating against the Zod schema
      return InputSchema.parse(parsedData);
    } catch (error) {
      console.error(error);
      throw new Error('Unable to read configuration file.');
    }
  }
}
