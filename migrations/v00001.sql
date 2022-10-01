-- BEGIN AnalyticsError --
CREATE TABLE "AnalyticsError" (
  "id" VARCHAR(26) NOT NULL,
  "type" VARCHAR(128) NOT NULL,
  "url" VARCHAR(512) NOT NULL,
  "userAgent" VARCHAR(512) NOT NULL,
  "body" JSON NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('AnalyticsError', 'createdAt');
-- END AnalyticsError --

-- BEGIN BlogEntry --
CREATE TABLE "BlogEntry" (
  "id" VARCHAR(26) NOT NULL,
  "story" VARCHAR(256) NOT NULL,
  "title" VARCHAR(256) NOT NULL,
  "message" TEXT,
  "imageFileExtension" VARCHAR(32),
  "imageWidth" INTEGER,
  "imageHeight" INTEGER,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("story", "title"),
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('BlogEntry', 'createdAt');
SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('BlogEntry', 'updatedAt');
-- END BlogEntry --

-- BEGIN UserRole --
CREATE TABLE "UserRole" (
  "id" VARCHAR(26) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "description" VARCHAR(512),
  UNIQUE ("name"),
  PRIMARY KEY ("id")
);
-- END UserRole --

-- BEGIN User --
CREATE TABLE "User" (
  "id" VARCHAR(26) NOT NULL,
  "username" VARCHAR(256) NOT NULL,
  "password" BIT(256) NOT NULL,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("username"),
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('User', 'createdAt');
SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('User', 'updatedAt');
-- END User --

-- BEGIN N2M_User_UserRole --
CREATE TABLE "N2M_User_UserRole" (
  "userId" VARCHAR(26) NOT NULL,
  "userRoleId" VARCHAR(26) NOT NULL,
  FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("userRoleId") REFERENCES "UserRole" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("userId", "userRoleId")
);

CREATE INDEX "idx_N2M_User_UserRole_userId" ON "N2M_User_UserRole" ("userId");
CREATE INDEX "idx_N2M_User_UserRole_userRoleId" ON "N2M_User_UserRole" ("userRoleId");
-- END N2M_User_UserRole --

-- BEGIN TriviaCategory --
CREATE TABLE "TriviaCategory" (
  "id" VARCHAR(26) NOT NULL,
  "name" VARCHAR(256) NOT NULL,
  "description" VARCHAR(512),
  "submitter" VARCHAR(256),
  "submitterUserId" VARCHAR(26),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" VARCHAR(26),
  UNIQUE ("name"),
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaCategory', 'createdAt');
SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaCategory', 'updatedAt');
-- END TriviaCategory --

-- BEGIN TriviaQuestion --
CREATE TABLE "TriviaQuestion" (
  "id" VARCHAR(26) NOT NULL,
  "question" VARCHAR(512) NOT NULL,
  "answer" VARCHAR(256) NOT NULL,
  "hint1" VARCHAR(256),
  "hint2" VARCHAR(256),
  "submitter" VARCHAR(256),
  "submitterUserId" VARCHAR(26),
  "verified" BOOLEAN NOT NULL DEFAULT false,
  "disabled" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedByUserId" VARCHAR(26),
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  FOREIGN KEY ("updatedByUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaQuestion', 'createdAt');
SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaQuestion', 'updatedAt');

CREATE VIRTUAL TABLE "TriviaQuestionFTS" USING fts5 (
  "question",
  "answer",
  "hint1",
  "hint2",
  "submitter",
  "SELECT group_concat(cat.name) FROM N2M_TriviaQuestion_TriviaCategory n2m JOIN TriviaCategory cat ON cat.id = n2m.categoryId WHERE n2m.questionId = $SRC.id",
  prefix = '3 4 5',
  tokenize = 'porter unicode61'
);
INSERT INTO "TriviaQuestionFTS" (
  "TriviaQuestionFTS",
  "rank"
) VALUES (
  'rank',
  'bm25(4, 4, 2, 2, 1, 1)'
);
SELECT __CREATE_FTS_SYNC_TRIGGERS('TriviaQuestion', 'TriviaQuestionFTS');
-- END TriviaQuestion --

-- BEGIN N2M_TriviaQuestion_TriviaCategory --
CREATE TABLE "N2M_TriviaQuestion_TriviaCategory" (
  "questionId" VARCHAR(26) NOT NULL,
  "categoryId" VARCHAR(26) NOT NULL,
  FOREIGN KEY ("questionId") REFERENCES "TriviaQuestion" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("categoryId") REFERENCES "TriviaCategory" ("id") ON DELETE CASCADE,
  PRIMARY KEY ("questionId", "categoryId")
);

CREATE INDEX "idx_N2M_TriviaQuestion_TriviaCategory_questionId" ON "N2M_TriviaQuestion_TriviaCategory" ("questionId");
CREATE INDEX "idx_N2M_TriviaQuestion_TriviaCategory_categoryId" ON "N2M_TriviaQuestion_TriviaCategory" ("categoryId");

SELECT __CREATE_FTS_SYNC_TRIGGERS_N2M('TriviaQuestion', 'TriviaQuestionFTS', 'N2M_TriviaQuestion_TriviaCategory', 'id', 'questionId');
-- END N2M_TriviaQuestion_TriviaCategory --

-- BEGIN TriviaReport --
CREATE TABLE "TriviaReport" (
  "id" VARCHAR(26) NOT NULL,
  "questionId" VARCHAR(26) NOT NULL,
  "message" VARCHAR(512) NOT NULL,
  "submitter" VARCHAR(256) NOT NULL,
  "submitterUserId" VARCHAR(26),
  "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("questionId", "submitter"),
  FOREIGN KEY ("questionId") REFERENCES "TriviaQuestion" ("id") ON DELETE CASCADE,
  FOREIGN KEY ("submitterUserId") REFERENCES "User" ("id") ON DELETE SET NULL,
  PRIMARY KEY ("id")
);

SELECT __CREATE_ISO_TIMESTAMP_TRIGGERS('TriviaReport', 'createdAt');

CREATE INDEX "idx_TriviaReport_questionId" ON "TriviaReport" ("questionId");
-- END TriviaReport --
