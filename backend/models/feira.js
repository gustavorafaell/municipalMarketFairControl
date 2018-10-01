/* jshint indent: 2 */
/* eslint-disable */

module.exports = function(sequelize, DataTypes) {
  const Feira = sequelize.define(
    'feira',
    {
      data: {
        type: DataTypes.DATEONLY,
        allowNull: false,
        defaultValue: '0000-00-00',
        primaryKey: true,
      },
      status: {
        type: DataTypes.INTEGER(1),
        allowNull: true,
        defaultValue: 1,
      },
    },
    {
      tableName: 'feira',
      timestamps: false,
      createdAt: false,
    },
  );
  return Feira;
};