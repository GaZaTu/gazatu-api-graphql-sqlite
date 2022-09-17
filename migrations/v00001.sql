-- BEGIN AnalyticsError --
CREATE TABLE "AnalyticsError" (
  "id" BIT(128) NOT NULL,
  "type" VARCHAR(128) NOT NULL,
  "url" VARCHAR(512) NOT NULL,
  "userAgent" VARCHAR(512) NOT NULL,
  "body" JSON NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('AnalyticsError', 'createdAt');
-- END AnalyticsError --

-- BEGIN BlogEntry --
CREATE TABLE "BlogEntry" (
  "id" BIT(128) NOT NULL,
  "story" VARCHAR(256) NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "message" TEXT,
  "imageMimeType" VARCHAR(128),
  "imageFileExtension" VARCHAR(128),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("story", "title"),
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('BlogEntry', 'createdAt');
!!CREATE_ISO_TIMESTAMP_TRIGGERS('BlogEntry', 'updatedAt');
-- END BlogEntry --

-- BEGIN Change --
CREATE TABLE "Change" (
  "id" BIT(128) NOT NULL,
  "kind" CHAR(1) CHECK ("kind" IN ('+','-','*')) NOT NULL,
  "targetEntity" VARCHAR(256) NOT NULL,
  "targetId" BIT(128),
  "targetColumn" VARCHAR(256),
  "newValue" TEXT,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('Change', 'createdAt');
-- END Change --

-- BEGIN UserRole --
CREATE TABLE "UserRole" (
  "id" BIT(128) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "description" VARCHAR(512),
  UNIQUE ("name"),
  PRIMARY KEY ("id")
);
-- END UserRole --

-- BEGIN User --
CREATE TABLE "User" (
  "id" BIT(128) NOT NULL,
  "username" VARCHAR(256) NOT NULL,
  "password" BIT(256) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("username"),
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('User', 'createdAt');
!!CREATE_ISO_TIMESTAMP_TRIGGERS('User', 'updatedAt');
-- END User --

-- BEGIN N2M_User_UserRole --
CREATE TABLE "N2M_User_UserRole" (
  "userId" BIT(128) NOT NULL,
  "userRoleId" BIT(128) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("userRoleId") REFERENCES "UserRole" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("userId", "userRoleId")
);

CREATE INDEX "idx_N2M_User_UserRole_userId" ON "N2M_User_UserRole" ("userId");
CREATE INDEX "idx_N2M_User_UserRole_userRoleId" ON "N2M_User_UserRole" ("userRoleId");
-- END N2M_User_UserRole --

-- BEGIN TriviaCategory --
CREATE TABLE "TriviaCategory" (
  "id" BIT(128) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "description" VARCHAR(512),
  "submitter" VARCHAR(256),
  "submitterUserId" BIT(128),
  "verified" BOOLEAN DEFAULT false,
  "disabled" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" BIT(128),
  UNIQUE ("name"),
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaCategory', 'createdAt');
!!CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaCategory', 'updatedAt');
-- END TriviaCategory --

-- BEGIN TriviaQuestion --
CREATE TABLE "TriviaQuestion" (
  "id" BIT(128) NOT NULL,
  "categoryId" BIT(128) NOT NULL,
  "question" VARCHAR(512) NOT NULL,
  "answer" VARCHAR(256) NOT NULL,
  "hint1" VARCHAR(256),
  "hint2" VARCHAR(256),
  "submitter" VARCHAR(256),
  "submitterUserId" BIT(128),
  "verified" BOOLEAN DEFAULT false,
  "disabled" BOOLEAN DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" BIT(128),
  FOREIGN KEY ("categoryId") REFERENCES "TriviaCategory" ("id") ON DELETE RESTRICT,
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaQuestion', 'createdAt');
!!CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaQuestion', 'updatedAt');

CREATE INDEX "idx_TriviaQuestion_categoryId" ON "TriviaQuestion" ("categoryId");

CREATE VIRTUAL TABLE "TriviaQuestionFTS" USING fts5 (
  "question",
  "answer",
  "hint1",
  "hint2",
  "submitter",
  "SELECT name FROM TriviaCategory WHERE id = $SRC.categoryId",
  prefix = '3 4 5',
  tokenize = 'porter unicode61',
  content = 'TriviaQuestion'
);
INSERT INTO "TriviaQuestionFTS" (
  "TriviaQuestionFTS",
  "rank"
) VALUES (
  'rank',
  'bm25(4, 4, 2, 2, 1, 1)'
);
!!CREATE_FTS_SYNC_TRIGGERS('TriviaQuestion', 'TriviaQuestionFTS');
-- END TriviaQuestion --

-- BEGIN TriviaReport --
CREATE TABLE "TriviaReport" (
  "id" BIT(128) NOT NULL,
  "questionId" BIT(128) NOT NULL,
  "message" VARCHAR(512) NOT NULL,
  "submitter" VARCHAR(256) NOT NULL,
  "submitterUserId" BIT(128),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("questionId", "submitter"),
  FOREIGN KEY ("questionId") REFERENCES "TriviaQuestion" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

!!CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaReport', 'createdAt');
-- END TriviaReport --
