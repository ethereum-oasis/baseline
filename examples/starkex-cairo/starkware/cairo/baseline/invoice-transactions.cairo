%builtins output pedersen range_check ecdsa

from starkware.cairo.common.cairo_builtins import SignatureBuiltin
from starkware.cairo.common.cairo_builtins import HashBuiltin
from starkware.cairo.common.hash import pedersen_hash
from starkware.cairo.common.signature import verify_ecdsa_signature
from starkware.cairo.common.math import assert_nn
from starkware.cairo.common.serialize import serialize_word
from starkware.cairo.common.serialize import serialize_array
from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.registers import get_label_location

from treemap import TreeMap
from treemap import KeyValue
from treemap import Result
from treemap import map_to_list
from treemap import list_to_map
from treemap import empty
from treemap import put
from treemap import get


struct Transaction:
    member from_pk = 0
    member to_pk = 1
    member amount = 2
    # member nonce = 3 # use nonce to avoid replay attacks
    member sig_r = 3 # sig(owner_sk, h(h(owner_pk,receiver_pk), amount) 
    member sig_s = 4
    const SIZE = 5
end


func verify_transaction(
    pedersen_ptr: HashBuiltin*,
    range_check_ptr, 
    ecdsa_ptr: SignatureBuiltin*, 
    tx: Transaction*,
    tx_hash: felt) -> (
        pedersen_ptr: HashBuiltin*, 
        range_check_ptr,
        ecdsa_ptr: SignatureBuiltin*):

    # check amount positive
    let (range_check_ptr) = assert_nn(range_check_ptr, tx.amount)

    # compute hash for signature check
    let (pedersen_ptr, msg_hash) = pedersen_hash(pedersen_ptr=pedersen_ptr, x=tx.from_pk, y=tx.to_pk)
    let (pedersen_ptr, msg_hash) = pedersen_hash(pedersen_ptr=pedersen_ptr, x=msg_hash, y=tx.amount)

    # check signature
    let (ecdsa_ptr) = verify_ecdsa_signature(ecdsa_ptr, msg_hash, tx.from_pk, tx.sig_r, tx.sig_s)
    
    # compute complete transaction hash
    let (pedersen_ptr, msg_hash) = pedersen_hash(pedersen_ptr=pedersen_ptr, x=msg_hash, y=tx.sig_r)
    let (pedersen_ptr, msg_hash) = pedersen_hash(pedersen_ptr=pedersen_ptr, x=msg_hash, y=tx.sig_s)
    # tx_hash is the hash for the secret tx
    assert msg_hash = tx_hash

    return (pedersen_ptr=pedersen_ptr, range_check_ptr=range_check_ptr, ecdsa_ptr=ecdsa_ptr)
end

# 
func verify_transactions(
    pedersen_ptr: HashBuiltin*, 
    range_check_ptr, 
    ecdsa_ptr: SignatureBuiltin*,
    transaction_list: Transaction*,
    n_transactions,
    transaction_hashes: felt*) -> (
        pedersen_ptr: HashBuiltin*, 
        range_check_ptr, 
        ecdsa_ptr: SignatureBuiltin*):

    if n_transactions == 0:
        return (pedersen_ptr, range_check_ptr, ecdsa_ptr)
    end

    let (pedersen_ptr, range_check_ptr, ecdsa_ptr) = verify_transaction(pedersen_ptr, range_check_ptr, ecdsa_ptr, transaction_list, [transaction_hashes])
    verify_transactions(pedersen_ptr, range_check_ptr, ecdsa_ptr, transaction_list + Transaction.SIZE, n_transactions-1, transaction_hashes + 1)
    return (...)
end


func process_transaction(
    range_check_ptr, 
    tx: Transaction*, 
    state: TreeMap*) -> (
        range_check_ptr, 
        state: TreeMap*):

    alloc_locals
    let (range_check_ptr, local from_balance: Result*) = get(range_check_ptr, tx.from_pk, state)

    let (range_check_ptr) = assert_nn(range_check_ptr, from_balance.value - tx.amount)

    let (range_check_ptr, local to_balance: Result*) = get(range_check_ptr, tx.to_pk, state)

    let (range_check_ptr, state) = put(range_check_ptr, tx.from_pk, from_balance.value - tx.amount, state)
    put(range_check_ptr, tx.to_pk, to_balance.value + tx.amount, state)
    return (...)
end


func process_transactions(
    range_check_ptr, 
    tx: Transaction*,
    tx_size, state: TreeMap*) -> (
        range_check_ptr,
        state: TreeMap*):

    if tx_size == 0:
        return (range_check_ptr, state)
    end

    let (range_check_ptr, state) = process_transaction(range_check_ptr, tx, state)
    process_transactions(range_check_ptr, tx + Transaction.SIZE, tx_size-1, state)
    return (...)
end


func compute_state_hash(
    pedersen_ptr: HashBuiltin*, 
    state_list: KeyValue*,
    list_length) -> (
        pedersen_ptr: HashBuiltin*, 
        hash):

    alloc_locals
    # TODO:
    # assert length != 0 (match functools.reduce)
    # tail recursion?

    let (pedersen_ptr, local entry_hash) =  pedersen_hash(pedersen_ptr, state_list.key, state_list.value)

    if list_length == 1:
        return (pedersen_ptr, entry_hash)
    end

    let (pedersen_ptr, chain_hash) = compute_state_hash(pedersen_ptr, state_list + KeyValue.SIZE, list_length-1)
    let (pedersen_ptr, chain_hash) = pedersen_hash(pedersen_ptr, entry_hash, chain_hash)
   
    return (pedersen_ptr, chain_hash)
end

func write_state_inner(state_list: KeyValue*, length) -> ():
    if length == 0:
        return ()
    end

    alloc_locals
    local key:felt
    local value:felt
    key = state_list.key
    value = state_list.value
    %{
       state[ids.key] = ids.value
    %}
    write_state_inner(state_list + KeyValue.SIZE, length - 1)
    return ()
end

func write_state(state_list: KeyValue*, length) -> ():
    %{
        state = {}
    %}
    write_state_inner(state_list, length)
    %{  
        import json
        with open("state.json", "w") as state_file:
            state_file.write(json.dumps(state, indent=4))
    %}
    return ()
end

func serialize_hash(output_ptr: felt*, hash) -> (output_ptr: felt*):
    serialize_word(output_ptr, [hash])
    return (...)
end


func main(
    output_ptr: felt*, 
    pedersen_ptr: HashBuiltin*, 
    range_check_ptr,
    ecdsa_ptr: SignatureBuiltin*) -> (
        output_ptr: felt*, 
        pedersen_ptr: HashBuiltin*, 
        range_check_ptr, 
        ecdsa_ptr: SignatureBuiltin*):
    
    alloc_locals
    # public
    local pre_state_hash: felt
    local post_state_hash: felt
    local transaction_hashes: felt*
    local transaction_hashes_length: felt

    # private 
    local transaction_list: Transaction*
    local transaction_list_length: felt
    local pre_state_list:  KeyValue*
    local pre_state_list_length: felt # TODO include in pre_state_hash?

    %{

        # Public input
        ids.pre_state_hash = int(program_input['public']['pre_state_hash'])
        tx_hashes = program_input['public']['transaction_hashes']
        ids.transaction_hashes_length = len(tx_hashes) 
        ids.transaction_hashes = transaction_hashes = segments.add()
        for i, val in enumerate(tx_hashes):
            memory[transaction_hashes + i] = int(val)


        # Private input
        # Populate balances
        pre_state = program_input['private']['pre_state']
        ids.pre_state_list_length = len(pre_state) 
        # load pre state to List of entries
        KEYVALUE_SIZE=ids.KeyValue.SIZE
        ids.pre_state_list = pre_state_list = segments.add()
        for i, val in enumerate(pre_state):
            memory[pre_state_list + i * KEYVALUE_SIZE] = val["owner"]
            memory[pre_state_list + i * KEYVALUE_SIZE + 1] = val["balance"]

        # Populate transactions list
        transactions = program_input['private']['transactions']
        ids.transaction_list_length = len(transactions) 
        TRANSACTION_SIZE=ids.Transaction.SIZE
        ids.transaction_list = transaction_list = segments.add()
        for i, val in enumerate(transactions):
            memory[transaction_list + i * TRANSACTION_SIZE] = val["from_pk"]
            memory[transaction_list + i * TRANSACTION_SIZE + 1] = val["to_pk"]
            memory[transaction_list + i * TRANSACTION_SIZE + 2] = val["amount"]
            memory[transaction_list + i * TRANSACTION_SIZE + 3] = val["sig_r"]
            memory[transaction_list + i * TRANSACTION_SIZE + 4] = val["sig_s"]
    %}

    # Proof that the initial state has the required hash
    let (local pedersen_ptr: HashBuiltin*, computed_pre_state_hash) = compute_state_hash(pedersen_ptr, pre_state_list, pre_state_list_length)
    assert pre_state_hash = computed_pre_state_hash

    # Convert the state from a list of KeyValue entries to a TreeMap
    let (range_check_ptr, local state: TreeMap*) = list_to_map(range_check_ptr, pre_state_list, pre_state_list_length)
    
    # Verify all transactions
    assert transaction_hashes_length = transaction_list_length
    let (local pedersen_ptr: HashBuiltin*, local range_check_ptr, local ecdsa_ptr: SignatureBuiltin*) = verify_transactions(pedersen_ptr, range_check_ptr, ecdsa_ptr, transaction_list, transaction_list_length, transaction_hashes)
   
    # Process all transactions
    let (local range_check_ptr, local post_state: TreeMap*) = process_transactions(range_check_ptr, transaction_list, transaction_list_length, state)
    
    # Convert the state from a TreeMap back to a list of KeyValue entries
    let (local post_state_list: KeyValue*, local post_state_list_length) = map_to_list(post_state)

    # Compute the hash of the state after processing all transactions
    let (local pedersen_ptr: HashBuiltin*, local computed_post_state_hash) = compute_state_hash(pedersen_ptr, post_state_list, post_state_list_length)
  
    # Persist post state
    write_state(post_state_list, post_state_list_length)

    # Output the public input for the verifier
    let (output_ptr) = serialize_word(output_ptr, pre_state_hash)
    let (output_ptr) = serialize_word(output_ptr, computed_post_state_hash)
    let (callback_addr) = get_label_location(serialize_hash)
    let (output_ptr) = serialize_array(output_ptr, transaction_hashes, transaction_hashes_length, 1, callback_addr)

    return (
        output_ptr=output_ptr, 
        pedersen_ptr=pedersen_ptr, 
        range_check_ptr=range_check_ptr, 
        ecdsa_ptr=ecdsa_ptr)
end

#> cairo-compile bank.cairo --output bank_compiled.json && cairo-run --program=bank_compiled.json --print_output --layout=small --program_input=input.json
