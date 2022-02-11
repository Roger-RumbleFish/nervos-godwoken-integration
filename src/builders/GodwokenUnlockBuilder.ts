import { Amount, AmountUnit, Builder, Cell, CellDep, DepType, normalizers, OutPoint, RawTransaction, Reader, Script, SerializeWitnessArgs, Transaction, WitnessArgs } from "@lay2/pw-core";
import { SerializeUnlockWithdrawalViaFinalize } from "@polyjuice-provider/godwoken/schemas";
import { CkitProvider } from '@ckitjs/ckit';
import { WithdrawalRequest } from "../bridge/utils/withdrawal";
import { AbstractPwSenderBuilder } from "@ckitjs/ckit/dist/tx-builders/pw/AbstractPwSenderBuilder";

function normalizeObject(debugPath: string, obj: any, keys: object) {
    const result: any = {};

    for (const [key, f] of Object.entries(keys)) {
        const value = obj[key];
        if (value === undefined || value === null) {
            throw new Error(`${debugPath} is missing ${key}!`);
        }
        result[key] = f(`${debugPath}.${key}`, value);
    }
    return result;
}

export function NormalizeUnlockWithdrawalViaFinalize(
    unlock_withdrawal_finalize: object,
    { debugPath = "unlock_withdrawal_finalize" } = {}
) {
    return normalizeObject(debugPath, unlock_withdrawal_finalize, {});
}

export interface GwUnlockBuilderCellDep {
    tx_hash: string;
    index: string;
    depType: 'code' | 'dep_group';
}

export default class GodwokenUnlockBuilder extends AbstractPwSenderBuilder {
    public fee = new Amount('0', AmountUnit.shannon);
    public withdrawalLockCellDep: CellDep;
    public rollupCellDep: CellDep;
    public defaultLockCellDep: CellDep;
    public omniLockCellDep: CellDep;

    constructor(
        public ownerLockScriptAddress: string,
        public withdrawalRequest: WithdrawalRequest,
        public provider: CkitProvider,
        public feeInShannons: string,
        _withdrawalLockCellDep: GwUnlockBuilderCellDep,
        _rollupCellDep: GwUnlockBuilderCellDep,
        _defaultLockCellDep: GwUnlockBuilderCellDep,
        _omniLockCellDep: GwUnlockBuilderCellDep,
    ) {
        super(provider);

        this.withdrawalLockCellDep = new CellDep(
            _withdrawalLockCellDep.depType as DepType,
            new OutPoint(
                _withdrawalLockCellDep.tx_hash,
                _withdrawalLockCellDep.index
            )
        );

        this.rollupCellDep = new CellDep(
            _rollupCellDep.depType as DepType,
            new OutPoint(
                _rollupCellDep.tx_hash,
                _rollupCellDep.index
            )
        );

        this.defaultLockCellDep = new CellDep(
            _defaultLockCellDep.depType as DepType,
            new OutPoint(
                _defaultLockCellDep.tx_hash,
                _defaultLockCellDep.index
            )
        );

        this.omniLockCellDep = new CellDep(
            _omniLockCellDep.depType as DepType,
            new OutPoint(
                _omniLockCellDep.tx_hash,
                _omniLockCellDep.index
            )
        );
    }

    async build(): Promise<Transaction> {
        const fee = new Amount(this.feeInShannons, AmountUnit.shannon);

        // Arrays for our input cells, output cells, and cell deps, which will be used in the final transaction.
        const inputCells: Cell[] = [];
        const outputCells: Cell[] = [];
        const cellDeps: CellDep[] = [];

        const ownerLockScript = this.provider.parseToScript(this.ownerLockScriptAddress);

        if (!ownerLockScript) {
            throw new Error(`Can't parse ownerLockScript.`);
        }

        const ownerLockScriptAsPwScript = Script.fromRPC(ownerLockScript);

        if (!ownerLockScriptAsPwScript) {
            throw new Error(`Can't convert ownerLockScript to PW Script.`);
        }

        // Create the output cell
        const outputCell = new Cell(
            new Amount(this.withdrawalRequest.amount.toString(), AmountUnit.shannon),
            ownerLockScriptAsPwScript,
            Script.fromRPC(this.withdrawalRequest.cell.cell_output.type),
            undefined,
            this.withdrawalRequest.cell.data
        );

        outputCells.push(outputCell);

        // Calculate the required remaining capacity. (Change cell minimum (61) + fee)
        const neededAmount = new Amount("61", AmountUnit.ckb).add(fee);

        const lockScript = Script.fromRPC(this.withdrawalRequest.cell.cell_output.lock);
        const typeScript = Script.fromRPC(this.withdrawalRequest.cell.cell_output.type);

        if (!lockScript || !this.withdrawalRequest.cell.out_point) {
            throw new Error('Unexpected lack of withdrawal request cell lock script.');
        }

        // Add input cell
        inputCells.push(
            new Cell(
                new Amount(this.withdrawalRequest.cell.cell_output.capacity, AmountUnit.shannon),
                lockScript,
                typeScript,
                new OutPoint(
                    this.withdrawalRequest.cell.out_point.tx_hash,
                    this.withdrawalRequest.cell.out_point.index
                ),
                this.withdrawalRequest.cell.data
            )
        );


        const capacityCells = await this.provider.collectLockOnlyCells(this.ownerLockScriptAddress, neededAmount.toString());

        for (const cell of capacityCells)
            inputCells.push(new Cell(
                new Amount(cell.cell_output.capacity, AmountUnit.shannon),
                Script.fromRPC(cell.cell_output.lock)!,
                Script.fromRPC(cell.cell_output.type),
                new OutPoint(cell.out_point?.tx_hash!, cell.out_point?.index!),
                cell.data
            ));

        // Calculate the input capacity and change cell amounts.
        const inputCapacity = inputCells.reduce((a, c) => a.add(c.capacity), Amount.ZERO);
        const changeCapacity = inputCapacity
            .sub(outputCell.capacity)
            .sub(fee);

        // Add the change cell.
        const changeLockScript = ownerLockScriptAsPwScript;
        const changeCell = new Cell(changeCapacity, changeLockScript);
        outputCells.push(changeCell);

        // Add the required cell deps.
        cellDeps.push(
            this.withdrawalLockCellDep,
            this.rollupCellDep,
            this.defaultLockCellDep,
            this.omniLockCellDep
        );

        // Generate a transaction and calculate the fee. (The second argument for witness args is needed for more accurate fee calculation.)
        const withdrawalWitnessArgsSerialized = this.getWithdrawalWitnessArgs();

        const tx = new Transaction(new RawTransaction(inputCells, outputCells, cellDeps),
            [
                withdrawalWitnessArgsSerialized,
                this.getWitnessPlaceholder(this.ownerLockScriptAddress)
            ]
        );
        this.fee = Builder.calcFee(tx);

        // Throw error if the fee is too low.
        if (this.fee.gt(fee))
            throw new Error(`Fee of ${fee} is below the calculated fee requirements of ${this.fee}.`);

        // Return our unsigned and non-broadcasted transaction.
        return tx;
    }

    getWithdrawalWitnessArgs(): string {
        const data =
            "0x00000000" +
            new Reader(
                SerializeUnlockWithdrawalViaFinalize(
                    NormalizeUnlockWithdrawalViaFinalize({})
                )
            )
                .serializeJson()
                .slice(2);

        const withdrawalWitnessArgs: WitnessArgs = {
            lock: data,
            input_type: '',
            output_type: ''
        };
        const withdrawalWitnessArgsSerialized = new Reader(
            SerializeWitnessArgs(
                normalizers.NormalizeWitnessArgs(withdrawalWitnessArgs)
            )
        ).serializeJson();

        return withdrawalWitnessArgsSerialized
    }
}
