import { Test, TestingModule } from "@nestjs/testing";
import { DBSchemaImportService } from "./dbSchemaImport.service";
import { ConfigService } from "@nestjs/config";
import { KafkaProducerService } from "@amplication/util/nestjs/kafka";
import { MockedAmplicationLoggerProvider } from "@amplication/util/nestjs/logging/test-utils";
import { DBSchemaImportMetadata } from "./types";
import { CreateDBSchemaImportArgs } from "./dto/CreateDBSchemaImportArgs";
import { EnumUserActionType } from "../userAction/types";
import { User } from "../../models";
import { PrismaService } from "../../prisma";
import { EntityService } from "../entity/entity.service";
import { UserService } from "../user/user.service";
import { UserActionService } from "../userAction/userAction.service";
import { ActionService } from "../action/action.service";
import { Env } from "../../env";

describe("DbSchemaImportService", () => {
  let service: DBSchemaImportService;
  let configService: ConfigService;
  let kafkaProducerService: KafkaProducerService;

  const mockCreateDBSchemaImportArgs: CreateDBSchemaImportArgs = {
    data: {
      userActionType: EnumUserActionType.DBSchemaImport,
      resource: {
        connect: {
          id: "mockResourceId",
        },
      },
    },
  };

  const mockDBSchemaImportMetadata: DBSchemaImportMetadata = {
    fileName: "mockFileName",
    schema: "mockSchema",
  };

  const mockUser: User = {
    id: "mockUserId",
    createdAt: new Date(),
    updatedAt: new Date(),
    isOwner: true,
  };

  const mockUserAction = {
    id: "mockUserActionId",
    resourceId: "mockResourceId",
    userId: "mockUserId",
    actionId: "mockActionId",
    userActionType: EnumUserActionType.DBSchemaImport,
    metadata: {
      fileName: "mockFileName",
      schema: "mockSchema",
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockCreateUserActionByTypeWithInitialStep = jest
    .fn()
    .mockReturnValue(mockUserAction);

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DBSchemaImportService,
        MockedAmplicationLoggerProvider,
        {
          provide: ConfigService,
          useValue: {
            get: (variable) => {
              switch (variable) {
                case "DB_SCHEMA_IMPORT_TOPIC":
                  return "db-schema-import-topic";
                default:
                  return "";
              }
            },
          },
        },
        {
          provide: PrismaService,
          useClass: jest.fn(() => ({
            userAction: {
              findFirst: jest.fn(),
              findUnique: jest.fn(),
            },
          })),
        },
        {
          provide: KafkaProducerService,
          useClass: jest.fn(() => ({
            emitMessage: jest.fn(),
          })),
        },
        {
          provide: EntityService,
          useClass: jest.fn(() => ({
            createEntitiesFromPrismaSchema: jest.fn(),
          })),
        },
        {
          provide: UserService,
          useClass: jest.fn(() => ({
            findUser: jest.fn(),
          })),
        },
        {
          provide: UserActionService,
          useClass: jest.fn(() => ({
            createUserActionByTypeWithInitialStep:
              mockCreateUserActionByTypeWithInitialStep,
          })),
        },
        {
          provide: ActionService,
          useClass: jest.fn(() => ({
            logByStepId: jest.fn(),
            complete: jest.fn(),
          })),
        },
      ],
    }).compile();

    service = module.get<DBSchemaImportService>(DBSchemaImportService);
    configService = module.get<ConfigService>(ConfigService);
    kafkaProducerService =
      module.get<KafkaProducerService>(KafkaProducerService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  it("should emit message to kafka", async () => {
    await service.startProcessingDBSchema(
      mockCreateDBSchemaImportArgs,
      mockDBSchemaImportMetadata,
      mockUser
    );

    const dbSchemaImportEvent = {
      key: null,
      value: {
        actionId: mockUserAction.actionId,
        file: mockDBSchemaImportMetadata.schema,
      },
    };

    expect(kafkaProducerService.emitMessage).toBeCalledTimes(1);
    expect(kafkaProducerService.emitMessage).toBeCalledWith(
      configService.get(Env.DB_SCHEMA_IMPORT_TOPIC),
      dbSchemaImportEvent
    );
  });
});
