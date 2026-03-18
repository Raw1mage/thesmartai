ALTER TABLE `provider`
	ADD COLUMN `name` varchar(255) NOT NULL DEFAULT '' AFTER `provider`;

UPDATE `provider`
SET `name` = `provider`
WHERE `name` = '';
