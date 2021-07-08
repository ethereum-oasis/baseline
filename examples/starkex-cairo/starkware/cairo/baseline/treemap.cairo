# Implements a simple, immutable tree map.

from starkware.cairo.common.alloc import alloc
from starkware.cairo.common.registers import get_fp_and_pc
from starkware.cairo.common.serialize import serialize_word
from starkware.cairo.common.math import assert_lt_felt

struct TreeMap:
    member key: felt = 0
    member value: felt = 1
    member left: TreeMap* = 2
    member right: TreeMap* = 3
    member empty: felt = 4 # 0 non_empty, 1 empty
    const SIZE = 5
end


struct Result:
    member value: felt = 0
    member empty: felt = 1 # 0 found value, 1 key not found
    const SIZE = 2
end

const false = 0
const true = 1

struct KeyValue:
    member key: felt = 0
    member value: felt = 1
    const SIZE = 2
end

# Creates an empty map
func empty() -> (map: TreeMap*):
    alloc_locals
    local empty_map: TreeMap
    #assert empty_map.key = 0
    #assert empty_map.value = 0
    #assert empty_map.left = 0
    #assert empty_map.right = 0
    assert empty_map.empty = true
    let (__fp__, _) = get_fp_and_pc()
    return (&empty_map)
end

# Returns a new map containing the given key->value entry
func put(range_check_ptr, key, value, map: TreeMap*) -> (range_check_ptr, map: TreeMap*):
    alloc_locals
    local result: TreeMap

    if map.empty == true:
        assert result.key = key
        assert result.value = value
        assert result.left = map # the empty map
        assert result.right = map # the empty map
        assert result.empty = false
        let (__fp__, _) = get_fp_and_pc()
        return (range_check_ptr, &result)
    else:
        if key == map.key:
            assert result.key = map.key
            assert result.value = value
            assert result.left = map.left
            assert result.right = map.right
            assert result.empty = false
            let (__fp__, _) = get_fp_and_pc()
            return (range_check_ptr, &result)
        else: 
            local go_left
            %{
                ids.go_left = int(ids.key < ids.map.key)
            %}
            if go_left == true:
                let (range_check_ptr) = assert_lt_felt(range_check_ptr, key, map.key)

                let (range_check_ptr, new_left) = put(range_check_ptr, key,value, map.left)
                assert result.key = map.key
                assert result.value = map.value
                assert result.left = new_left
                assert result.right = map.right
                assert result.empty = false
                let (__fp__, _) = get_fp_and_pc()
                return (range_check_ptr, &result)
            else:
                let (range_check_ptr) = assert_lt_felt(range_check_ptr, map.key, key)

                let (range_check_ptr, new_right) = put(range_check_ptr, key,value, map.right)
                assert result.key = map.key
                assert result.value = map.value
                assert result.left = map.left
                assert result.right = new_right
                assert result.empty = false
                let (__fp__, _) = get_fp_and_pc()
                return (range_check_ptr, &result)
            end
        end
    end
end

# Returns a Result containing the value for the given key.
# If the key can not be found in the map the result is marked with empty = 1.
func get(range_check_ptr, key, map: TreeMap*) -> (range_check_ptr, result: Result*):
    alloc_locals
    local result: Result
    if map.empty == true:
        # assert result.value = 0
        assert result.empty = true
        let (__fp__, _) = get_fp_and_pc()
        return (range_check_ptr, &result)
    else:
        if key == map.key:
            assert result.value = map.value
            assert result.empty = false
            let (__fp__, _) = get_fp_and_pc()
            return (range_check_ptr, &result)
        else: 
            local go_left
            %{
                ids.go_left = int(ids.key < ids.map.key)
            %}
            if go_left == true:
                let (range_check_ptr) = assert_lt_felt(range_check_ptr, key, map.key)

                get(range_check_ptr, key, map.left)
                return (...)
            else:
                let (range_check_ptr) = assert_lt_felt(range_check_ptr, map.key, key)

                get(range_check_ptr, key, map.right)
                return (...)
            end
        end
    end
end


# Returns the given default value if no entry can be found in the given map.
func get_or_default(range_check_ptr, key, defaulValue, map: TreeMap*) -> (range_check_ptr, value: felt):
    let (range_check_ptr, result) = get(range_check_ptr, key, map)
    if result.empty == true:

        return (range_check_ptr, defaulValue)
    else:
        return (range_check_ptr, result.value)
    end
end


# Preorder output of the map.
func output_treemap(output_ptr : felt*, map: TreeMap*) -> (output_ptr : felt*):
    if map.empty == 1:
        return (output_ptr)
    else:
        let (output_ptr) = output_treemap(output_ptr, map.left)

        let (output_ptr) = serialize_word(output_ptr, map.key)
        let (output_ptr) = serialize_word(output_ptr, map.value)

        let (output_ptr) = output_treemap(output_ptr, map.right)
        return (output_ptr)
    end
end


func map_to_list_inner(map: TreeMap*, list: KeyValue*, list_length) -> (list: KeyValue*, list_length):
    alloc_locals
    if map.empty == true:
        return (list, list_length)
    else:
        let (local list: KeyValue*, list_length) = map_to_list_inner(map.left, list, list_length)
        assert list.key = map.key
        assert list.value = map.value
        map_to_list_inner(map.right, list + KeyValue.SIZE, list_length+1)
        return (...)
    end
end


# Converts a TreeMap to a list of KeyValue entries.
func map_to_list(map: TreeMap*) -> (list: KeyValue*, list_length):
    alloc_locals
    let (empty_list) = alloc()
    local list_start : KeyValue* = empty_list
    let (_, length) = map_to_list_inner(map, list_start, 0)
    return (list_start, length)
end


func list_to_map_inner(range_check_ptr, list: KeyValue*, list_length, map: TreeMap*) -> (range_check_ptr, state: TreeMap*):
    if list_length == 0:
        return (range_check_ptr, map)
    end

    let (range_check_ptr, map) = put(range_check_ptr, list.key, list.value, map)
    list_to_map_inner(range_check_ptr, list + KeyValue.SIZE, list_length-1, map)
    return (...)
end


# Converts a list of KeyValue entries into a TreeMap.
func list_to_map(range_check_ptr, list: KeyValue*, list_length) -> (range_check_ptr, map: TreeMap*):
    let (empty_map) = empty()

    list_to_map_inner(range_check_ptr, list, list_length, empty_map)
    return (...)
end
